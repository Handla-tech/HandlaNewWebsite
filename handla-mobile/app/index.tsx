import { Redirect } from 'expo-router';

/**
 * Entry route. The AuthGate in _layout handles the real redirect once the
 * auth status resolves; this just points somewhere valid initially.
 */
export default function Index() {
  return <Redirect href="/(app)/dashboard" />;
}
