import { useAuthStore } from '../../entities/user/model/useAuthStore';

export function AuthProvider({ children }) {
  const user = useAuthStore((state) => state.user);
  return children({ user });
}
