/** Web preview: Google sign-in is only wired up in the native apps. */
export const authAvailable = false;

export async function signIn(): Promise<string | null> {
  throw new Error('Google sign-in is available in the iOS and Android apps');
}
export async function signOut(): Promise<void> {}
export async function getAccessToken(): Promise<string> {
  throw new Error('Not signed in to Google');
}
