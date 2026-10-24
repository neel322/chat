const db = require('../config/db');

// 1. Get user conversations
exports.getUserConversations = async (req, res) => {
  const userId = req.user.id;
  try {
    const query = `
      SELECT 
        c.id,
        c.is_group,
        c.title,
        c.avatar_url,
        cp.role,
        cp.last_read_at,
        (
  SELECT COUNT(*)::int
  FROM public.messages m
  WHERE m.conversation_id = c.id 
    AND m.created_at > cp.last_read_at
    AND m.media_type != 'system'
    AND (m.sender_id IS NOT NULL AND m.sender_id::text != $1::text)
) AS unread_count,
 (
          SELECT json_build_object(
            'id', lm.id,
            'content', lm.content,
            'media_type', lm.media_type,
            'sender_id', lm.sender_id,
            'created_at', lm.created_at
          )
          FROM public.messages lm
          WHERE lm.conversation_id = c.id
          ORDER BY lm.created_at DESC
          LIMIT 1
        ) AS last_message,
        CASE 
          WHEN c.is_group = FALSE THEN (
            SELECT json_build_object(
              'id', u.id,
              'username', u.username,
              'avatar_url', u.avatar_url,
              'last_seen', u.last_seen
            )
            FROM public.conversation_participants other_cp
            JOIN public.users u ON u.id = other_cp.user_id
            WHERE other_cp.conversation_id = c.id AND other_cp.user_id::text != $1::text
            LIMIT 1
          )
          ELSE NULL
        END AS direct_recipient
      FROM public.conversations c
      JOIN public.conversation_participants cp ON cp.conversation_id = c.id
      WHERE cp.user_id::text = $1::text
      ORDER BY COALESCE(
        (SELECT MAX(created_at) FROM public.messages WHERE conversation_id = c.id),
        c.created_at
      ) DESC;
    `;
    const result = await db.query(query, [String(userId)]);
    res.json(result.rows);
  } catch (err) {
    console.error('getUserConversations error:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
};

// chat-backend/src/controllers/chatController.js

// 2. Get message history (LEFT JOIN preserves system messages where sender_id IS NULL)
// chat-backend/src/controllers/chatController.js

// 1. Fetch History (LEFT JOIN ensures sender_id NULL rows are ALWAYS returned)
exports.getMessageHistory = async (req, res) => {
  const conversationId = req.params.conversationId ? String(req.params.conversationId).trim() : null;
  const currentUserId = req.user?.id ? String(req.user.id).trim() : null;
  const limit = parseInt(req.query.limit, 10) || 100;

  if (!conversationId) {
    return res.status(400).json({ error: 'Invalid conversation ID' });
  }

  try {
    const memberCheck = await db.query(
      `SELECT 1 FROM public.conversation_participants 
       WHERE conversation_id::text = $1::text AND user_id::text = $2::text`,
      [conversationId, currentUserId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized for this chat' });
    }

    // Fetch the LATEST $2 messages, then re-sort ascending for display.
    // The old query (ORDER BY ASC LIMIT N) returned the OLDEST N messages,
    // meaning new messages in long conversations were silently cut off.
    const query = `
      SELECT * FROM (
        SELECT 
          m.id,
          m.conversation_id,
          m.sender_id,
          m.content,
          m.media_url,
          COALESCE(m.media_type, 'text') AS media_type,
          m.created_at,
          CASE 
            WHEN m.sender_id IS NOT NULL THEN json_build_object(
              'id', u.id,
              'username', u.username,
              'avatar_url', u.avatar_url
            )
            ELSE NULL
          END AS sender
        FROM public.messages m
        LEFT JOIN public.users u ON u.id = m.sender_id
        WHERE m.conversation_id::text = $1::text
        ORDER BY m.created_at DESC
        LIMIT $2
      ) latest
      ORDER BY latest.created_at ASC;
    `;

    const result = await db.query(query, [conversationId, limit]);

    // Fetch the other participants' last_read_at so the frontend can show
    // accurate read-receipt ticks (✓ vs ✓✓) immediately after a refresh,
    // without waiting for a live socket message:read_receipt event.
    //
    // One row per OTHER participant — a 1:1 DM has exactly one row, a group
    // has one row per member besides the current user. We hand the WHOLE
    // list to the frontend (not a single collapsed value) so it can require
    // EVERY member to have read a message before showing a double tick,
    // instead of flipping to "seen" as soon as just one person reads it.
    const receiptRes = await db.query(
      `SELECT user_id, last_read_at
       FROM public.conversation_participants
       WHERE conversation_id::text = $1::text AND user_id::text != $2::text`,
      [conversationId, currentUserId]
    );

    const otherParticipantReads = receiptRes.rows.map((r) => ({
      userId: r.user_id,
      readAt: r.last_read_at,
    }));

    console.log(`[DB] Fetched ${result.rows.length} messages for room ${conversationId}`);
    res.json({
      messages: result.rows,
      otherParticipantReads, // ← array: [{ userId, readAt }, ...] one per OTHER participant
      nextCursor: null
    });
  } catch (err) {
    console.error('Error in getMessageHistory:', err);
    res.status(500).json({ error: 'Failed to retrieve messages' });
  }
};

// 2. Leave Group with Guaranteed System Message Insertion
exports.leaveGroup = async (req, res) => {
  const conversationId = req.params.conversationId ? String(req.params.conversationId).trim() : null;
  const currentUserId = String(req.user.id);
  const currentUsername = req.user.username || 'A member';

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const roleCheck = await client.query(
      `SELECT role FROM public.conversation_participants 
       WHERE conversation_id::text = $1::text AND user_id::text = $2::text`,
      [conversationId, currentUserId]
    );

    if (roleCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not a member of this group' });
    }

    const leavingUserRole = roleCheck.rows[0].role;

    // Remove user
    await client.query(
      `DELETE FROM public.conversation_participants 
       WHERE conversation_id::text = $1::text AND user_id::text = $2::text`,
      [conversationId, currentUserId]
    );

    // Fetch remaining members
    const remainingRes = await client.query(
      `SELECT cp.user_id, cp.role, u.username 
       FROM public.conversation_participants cp
       JOIN public.users u ON u.id = cp.user_id
       WHERE cp.conversation_id::text = $1::text`,
      [conversationId]
    );

    const remainingMembers = remainingRes.rows;

    if (remainingMembers.length === 0) {
      await client.query('DELETE FROM public.conversations WHERE id::text = $1::text', [conversationId]);
    } else {
      let adminChangeText = '';

      // Auto-assign random admin if sole admin left
      if (leavingUserRole === 'admin') {
        const hasOtherAdmin = remainingMembers.some((m) => m.role === 'admin');
        if (!hasOtherAdmin) {
          const randomPickRes = await client.query(
            `SELECT cp.user_id, u.username 
             FROM public.conversation_participants cp
             JOIN public.users u ON u.id = cp.user_id
             WHERE cp.conversation_id::text = $1::text
             ORDER BY RANDOM()
             LIMIT 1`,
            [conversationId]
          );

          if (randomPickRes.rows.length > 0) {
            const newAdmin = randomPickRes.rows[0];
            await client.query(
              `UPDATE public.conversation_participants 
               SET role = 'admin' 
               WHERE conversation_id::text = $1::text AND user_id::text = $2::text`,
              [conversationId, String(newAdmin.user_id)]
            );
            adminChangeText = ` ${newAdmin.username} is now an admin.`;
          }
        }
      }

      // INSERT SYSTEM NOTIFICATION
      const noticeContent = `${currentUsername} left the group.${adminChangeText}`;
      const sysMsgRes = await client.query(
        `INSERT INTO public.messages (conversation_id, sender_id, content, media_type)
         VALUES ($1, NULL, $2, 'system')
         RETURNING id, conversation_id, sender_id, content, media_type, created_at;`,
        [conversationId, noticeContent]
      );

      const systemMessage = sysMsgRes.rows[0];
      console.log('[DB] System notice inserted successfully:', systemMessage);

      // Broadcast via Socket
      if (req.app.get('io')) {
        req.app.get('io').to(`conversation_${conversationId}`).emit('message:new', {
          ...systemMessage,
          is_system: true,
          sender: null
        });
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Left group successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('leaveGroup error:', err);
    res.status(500).json({ error: 'Failed to leave group' });
  } finally {
    client.release();
  }
};

// 3. Add Member with Guaranteed System Message Insertion
exports.addMemberToGroup = async (req, res) => {
  const conversationId = req.params.conversationId ? String(req.params.conversationId).trim() : null;
  const currentUsername = req.user.username || 'Admin';
  const { newUserId } = req.body;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT username FROM public.users WHERE id::text = $1::text',
      [String(newUserId)]
    );
    const addedUsername = userRes.rows[0]?.username || 'A member';

    await client.query(
      `INSERT INTO public.conversation_participants (conversation_id, user_id, role, last_read_at)
       VALUES ($1, $2, 'member', CURRENT_TIMESTAMP)`,
      [conversationId, String(newUserId)]
    );

    // INSERT SYSTEM NOTICE
    const sysMsgRes = await client.query(
      `INSERT INTO public.messages (conversation_id, sender_id, content, media_type)
       VALUES ($1, NULL, $2, 'system')
       RETURNING id, conversation_id, sender_id, content, media_type, created_at;`,
      [conversationId, `${currentUsername} added ${addedUsername} to the group`]
    );

    const systemMessage = sysMsgRes.rows[0];
    console.log('[DB] Add-member system notice saved:', systemMessage);

    if (req.app.get('io')) {
      req.app.get('io').to(`conversation_${conversationId}`).emit('message:new', {
        ...systemMessage,
        is_system: true,
        sender: null
      });
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Member added successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('addMember error:', err);
    res.status(500).json({ error: 'Failed to add member' });
  } finally {
    client.release();
  }
};

// 3. Get group members (No created_by column reference)
exports.getGroupMembers = async (req, res) => {
  const conversationId = req.params.conversationId ? String(req.params.conversationId).trim() : null;

  if (!conversationId) {
    return res.status(400).json({ error: 'Invalid conversation ID' });
  }

  try {
    // 1. Confirm conversation exists without selecting created_by
    const convCheck = await db.query(
      'SELECT id, is_group, title FROM public.conversations WHERE id::text = $1::text',
      [conversationId]
    );

    if (convCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // 2. Fetch all participants from conversation_participants and join with users
    const membersQuery = `
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.avatar_url, 
        COALESCE(cp.role, 'member') AS role,
        cp.joined_at
      FROM public.conversation_participants cp
      JOIN public.users u ON u.id = cp.user_id
      WHERE cp.conversation_id::text = $1::text
      ORDER BY (cp.role = 'admin') DESC, cp.joined_at ASC;
    `;

    const result = await db.query(membersQuery, [conversationId]);
    res.json(result.rows);
  } catch (err) {
    console.error('getGroupMembers error:', err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
};

// chat-backend/src/controllers/chatController.js

// 1. Promote Admin
exports.makeAdmin = async (req, res) => {
  const conversationId = req.params.conversationId ? String(req.params.conversationId).trim() : null;
  const { targetUserId } = req.body;
  const currentUserId = String(req.user.id);
  const currentUsername = req.user.username || 'Admin';

  try {
    const adminCheck = await db.query(
      `SELECT role FROM public.conversation_participants 
       WHERE conversation_id::text = $1::text AND user_id::text = $2::text`,
      [conversationId, currentUserId]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can promote members' });
    }

    const targetUser = await db.query('SELECT username FROM public.users WHERE id::text = $1::text', [String(targetUserId)]);
    const targetUsername = targetUser.rows[0]?.username || 'A member';

    await db.query(
      `UPDATE public.conversation_participants SET role = 'admin' 
       WHERE conversation_id::text = $1::text AND user_id::text = $2::text`,
      [conversationId, String(targetUserId)]
    );

    // Insert System Notice
    const sysMsgRes = await db.query(
      `INSERT INTO public.messages (conversation_id, sender_id, content, media_type)
       VALUES ($1, NULL, $2, 'system')
       RETURNING id, conversation_id, sender_id, content, media_type, created_at;`,
      [conversationId, `${currentUsername} made ${targetUsername} an admin`]
    );

    if (req.app.get('io')) {
      req.app.get('io').to(`conversation_${conversationId}`).emit('message:new', {
        ...sysMsgRes.rows[0],
        is_system: true,
        sender: null
      });
    }

    res.json({ message: 'User promoted to admin' });
  } catch (err) {
    console.error('makeAdmin error:', err);
    res.status(500).json({ error: 'Failed to promote member' });
  }
};

// 2. Rename Group
exports.updateGroupName = async (req, res) => {
  const conversationId = req.params.conversationId ? String(req.params.conversationId).trim() : null;
  const { title } = req.body;
  const currentUserId = String(req.user.id);
  const currentUsername = req.user.username || 'Admin';

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title cannot be empty' });
  }

  try {
    const adminCheck = await db.query(
      `SELECT role FROM public.conversation_participants 
       WHERE conversation_id::text = $1::text AND user_id::text = $2::text`,
      [conversationId, currentUserId]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can change group name' });
    }

    const updateRes = await db.query(
      'UPDATE public.conversations SET title = $1 WHERE id::text = $2::text RETURNING *',
      [title.trim(), conversationId]
    );

    // Insert System Notice
    const sysMsgRes = await db.query(
      `INSERT INTO public.messages (conversation_id, sender_id, content, media_type)
       VALUES ($1, NULL, $2, 'system')
       RETURNING id, conversation_id, sender_id, content, media_type, created_at;`,
      [conversationId, `${currentUsername} changed group name to "${title.trim()}"`]
    );

    if (req.app.get('io')) {
      req.app.get('io').to(`conversation_${conversationId}`).emit('message:new', {
        ...sysMsgRes.rows[0],
        is_system: true,
        sender: null
      });
    }

    res.json(updateRes.rows[0]);
  } catch (err) {
    console.error('updateGroupName error:', err);
    res.status(500).json({ error: 'Failed to update group name' });
  }
};

// chat-backend/src/controllers/chatController.js

// 7. Leave group with automated system notice
// chat-backend/src/controllers/chatController.js

exports.leaveGroup = async (req, res) => {
  const conversationId = req.params.conversationId ? String(req.params.conversationId).trim() : null;
  const currentUserId = String(req.user.id);
  const currentUsername = req.user.username || 'A member';

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify user membership
    const roleCheck = await client.query(
      `SELECT role FROM public.conversation_participants 
       WHERE conversation_id::text = $1::text AND user_id::text = $2::text`,
      [conversationId, currentUserId]
    );

    if (roleCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not a member of this group' });
    }

    const leavingUserRole = roleCheck.rows[0].role;

    // 2. Remove the leaving user
    await client.query(
      `DELETE FROM public.conversation_participants 
       WHERE conversation_id::text = $1::text AND user_id::text = $2::text`,
      [conversationId, currentUserId]
    );

    // 3. Check remaining participants
    const remainingRes = await client.query(
      `SELECT cp.user_id, cp.role, u.username 
       FROM public.conversation_participants cp
       JOIN public.users u ON u.id = cp.user_id
       WHERE cp.conversation_id::text = $1::text`,
      [conversationId]
    );

    const remainingMembers = remainingRes.rows;

    if (remainingMembers.length === 0) {
      // Last person left, delete the group entirely
      await client.query('DELETE FROM public.conversations WHERE id::text = $1::text', [conversationId]);
    } else {
      let newAdminNotification = '';

      // If the leaving user was an admin, verify if another admin remains
      if (leavingUserRole === 'admin') {
        const hasOtherAdmin = remainingMembers.some((m) => m.role === 'admin');

        if (!hasOtherAdmin) {
          // Select a RANDOM remaining participant
          const randomPickRes = await client.query(
            `SELECT cp.user_id, u.username 
             FROM public.conversation_participants cp
             JOIN public.users u ON u.id = cp.user_id
             WHERE cp.conversation_id::text = $1::text
             ORDER BY RANDOM()
             LIMIT 1`,
            [conversationId]
          );

          if (randomPickRes.rows.length > 0) {
            const newAdmin = randomPickRes.rows[0];
            await client.query(
              `UPDATE public.conversation_participants 
               SET role = 'admin' 
               WHERE conversation_id::text = $1::text AND user_id::text = $2::text`,
              [conversationId, String(newAdmin.user_id)]
            );
            newAdminNotification = ` ${newAdmin.username} has been assigned as the new admin.`;
          }
        }
      }

      // 4. Insert in-stream system message
      const systemNotice = `${currentUsername} left the group.${newAdminNotification}`;
      const sysMsgRes = await client.query(
        `INSERT INTO public.messages (conversation_id, sender_id, content, media_type)
         VALUES ($1, NULL, $2, 'system')
         RETURNING id, conversation_id, sender_id, content, media_type, created_at`,
        [conversationId, systemNotice]
      );

      const systemMessage = sysMsgRes.rows[0];

      // Broadcast live event to room
      if (req.app.get('io')) {
        req.app.get('io').to(`conversation_${conversationId}`).emit('message:new', {
          ...systemMessage,
          is_system: true,
          sender: null
        });
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Left group successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('leaveGroup error:', err);
    res.status(500).json({ error: 'Failed to leave group' });
  } finally {
    client.release();
  }
};

// 6. Kick member with automated system notice
exports.kickMember = async (req, res) => {
  const conversationId = req.params.conversationId ? String(req.params.conversationId).trim() : null;
  const { targetUserId } = req.body;
  const currentUserId = req.user.id;

  try {
    const adminCheck = await db.query(
      `SELECT role FROM public.conversation_participants 
       WHERE conversation_id::text = $1::text AND user_id::text = $2::text`,
      [conversationId, String(currentUserId)]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can remove members' });
    }

    // Get target username for notification
    const targetUser = await db.query('SELECT username FROM public.users WHERE id::text = $1::text', [String(targetUserId)]);
    const targetUsername = targetUser.rows[0]?.username || 'A member';

    await db.query(
      `DELETE FROM public.conversation_participants 
       WHERE conversation_id::text = $1::text AND user_id::text = $2::text`,
      [conversationId, String(targetUserId)]
    );

    // Insert system notification
    const sysMsgRes = await db.query(
      `INSERT INTO public.messages (conversation_id, sender_id, content, media_type)
       VALUES ($1, NULL, $2, 'system')
       RETURNING id, conversation_id, sender_id, content, media_type, created_at`,
      [conversationId, `${targetUsername} was removed from the group`]
    );

    if (req.app.get('io')) {
      req.app.get('io').to(`conversation_${conversationId}`).emit('message:new', {
        ...sysMsgRes.rows[0],
        is_system: true,
        sender: null
      });
    }

    res.json({ message: 'Member removed' });
  } catch (err) {
    console.error('kickMember error:', err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
};

// 8. Delete group permanently
exports.deleteGroup = async (req, res) => {
  const conversationId = req.params.conversationId ? String(req.params.conversationId).trim() : null;
  const currentUserId = req.user.id;

  try {
    const adminCheck = await db.query(
      `SELECT role FROM public.conversation_participants 
       WHERE conversation_id::text = $1::text AND user_id::text = $2::text`,
      [conversationId, String(currentUserId)]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete this group' });
    }

    await db.query('DELETE FROM public.conversations WHERE id::text = $1::text', [conversationId]);

    if (req.app.get('io')) {
      req.app.get('io').to(`conversation_${conversationId}`).emit('group:deleted', { conversationId });
    }

    res.json({ message: 'Group deleted successfully', conversationId });
  } catch (err) {
    console.error('deleteGroup error:', err);
    res.status(500).json({ error: 'Failed to delete group' });
  }
};

// 9. Direct chat
exports.createOrGetDirectChat = async (req, res) => {
  const userId = req.user.id;
  const { recipientId } = req.body;

  if (!recipientId || String(recipientId) === String(userId)) {
    return res.status(400).json({ error: 'Invalid recipient ID' });
  }

  try {
    const existing = await db.query(`
      SELECT cp1.conversation_id 
      FROM public.conversation_participants cp1
      JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
      JOIN public.conversations c ON c.id = cp1.conversation_id
      WHERE cp1.user_id::text = $1::text AND cp2.user_id::text = $2::text AND c.is_group = FALSE
      LIMIT 1;
    `, [String(userId), String(recipientId)]);

    if (existing.rows.length > 0) {
      return res.json({ conversationId: existing.rows[0].conversation_id });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const convRes = await client.query(
        'INSERT INTO public.conversations (is_group, created_by) VALUES (FALSE, $1) RETURNING id',
        [userId]
      );
      const convId = convRes.rows[0].id;
      await client.query(
        `INSERT INTO public.conversation_participants (conversation_id, user_id, role)
         VALUES ($1, $2, 'member'), ($1, $3, 'member')`,
        [convId, userId, recipientId]
      );
      await client.query('COMMIT');
      res.status(201).json({ conversationId: convId });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('createOrGetDirectChat error:', err);
    res.status(500).json({ error: 'Could not create conversation' });
  }
};

// 10. Create group chat (No created_by column dependency)
exports.createGroupChat = async (req, res) => {
  const userId = req.user.id;
  const { title, participantIds = [] } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Group title is required' });
  }

  const memberSet = new Set(participantIds.map(String));
  memberSet.add(String(userId));
  const allMembers = Array.from(memberSet);

  if (allMembers.length < 2) {
    return res.status(400).json({ error: 'A group requires at least 2 members' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const convRes = await client.query(
      'INSERT INTO public.conversations (is_group, title) VALUES (TRUE, $1) RETURNING *',
      [title.trim()]
    );
    const newConv = convRes.rows[0];

    // Mark the creator as admin in conversation_participants
    for (const mId of allMembers) {
      const role = String(mId) === String(userId) ? 'admin' : 'member';
      await client.query(
        `INSERT INTO public.conversation_participants (conversation_id, user_id, role)
         VALUES ($1, $2, $3)`,
        [newConv.id, mId, role]
      );
    }

    // Insert the "group created" system message ONCE (previously this ran once
    // per member inside the loop above, so a 3-person group would show the
    // same "created the group" message 3 times).
    await client.query(
      `INSERT INTO public.messages (conversation_id, sender_id, content, media_type)
       VALUES ($1, NULL, $2, 'system')`,
      [newConv.id, `${req.user.username || 'Admin'} created the group "${title.trim()}"`]
    );

    await client.query('COMMIT');
    res.status(201).json({
      id: newConv.id,
      is_group: true,
      title: newConv.title,
      role: 'admin',
      member_count: allMembers.length,
      unread_count: 0,
      last_message: null
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createGroupChat error:', err);
    res.status(500).json({ error: 'Failed to create group' });
  } finally {
    client.release();
  }
};

// 11. Media Upload
exports.uploadMedia = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  let mediaType = 'file';
  if (req.file.mimetype.startsWith('image/')) mediaType = 'image';
  else if (req.file.mimetype.startsWith('video/')) mediaType = 'video';

  res.status(201).json({
    mediaUrl: req.file.path,
    mediaType,
    fileName: req.file.originalname,
    fileSize: req.file.size
  });
};

// Add a user to an existing group
exports.addMemberToGroup = async (req, res) => {
  const conversationId = req.params.conversationId ? String(req.params.conversationId).trim() : null;
  const currentUserId = String(req.user.id);
  const currentUsername = req.user.username || 'A member';
  const { newUserId } = req.body;

  if (!conversationId || !newUserId) {
    return res.status(400).json({ error: 'Conversation ID and new user ID are required' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Confirm conversation is a group
    const convRes = await client.query(
      `SELECT is_group FROM public.conversations WHERE id::text = $1::text`,
      [conversationId]
    );

    if (convRes.rows.length === 0 || !convRes.rows[0].is_group) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Conversation is not a valid group' });
    }

    // 2. Verify requesting user is an active participant in this group
    const requesterCheck = await client.query(
      `SELECT role FROM public.conversation_participants 
       WHERE conversation_id::text = $1::text AND user_id::text = $2::text`,
      [conversationId, currentUserId]
    );

    if (requesterCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    // Optional constraint: Only admins can add members
    // if (requesterCheck.rows[0].role !== 'admin') {
    //   await client.query('ROLLBACK');
    //   return res.status(403).json({ error: 'Only admins can add new members' });
    // }

    // 3. Verify target user is not already in the group
    const existingCheck = await client.query(
      `SELECT 1 FROM public.conversation_participants 
       WHERE conversation_id::text = $1::text AND user_id::text = $2::text`,
      [conversationId, String(newUserId)]
    );

    if (existingCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'User is already a member of this group' });
    }

    // 4. Fetch target user's username
    const userRes = await client.query(
      `SELECT id, username, email, avatar_url FROM public.users WHERE id::text = $1::text`,
      [String(newUserId)]
    );

    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const addedUser = userRes.rows[0];

    // 5. Insert participant
    await client.query(
      `INSERT INTO public.conversation_participants (conversation_id, user_id, role, last_read_at)
       VALUES ($1, $2, 'member', CURRENT_TIMESTAMP)`,
      [conversationId, String(newUserId)]
    );

    // 6. Insert in-stream system notification
    const sysMsgRes = await client.query(
      `INSERT INTO public.messages (conversation_id, sender_id, content, media_type)
       VALUES ($1, NULL, $2, 'system')
       RETURNING id, conversation_id, sender_id, content, media_type, created_at;`,
      [conversationId, `${currentUsername} added ${addedUser.username} to the group`]
    );

    const systemMessage = sysMsgRes.rows[0];

    // 7. Emit socket message
    if (req.app.get('io')) {
      req.app.get('io').to(`conversation_${conversationId}`).emit('message:new', {
        ...systemMessage,
        is_system: true,
        sender: null
      });
    }

    await client.query('COMMIT');
    res.status(201).json({ 
      message: 'Member added successfully', 
      user: addedUser 
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error adding member to group:', err);
    res.status(500).json({ error: 'Failed to add member to group' });
  } finally {
    client.release();
  }
};