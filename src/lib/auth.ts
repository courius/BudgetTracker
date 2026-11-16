/** Google account access (native). The web build uses auth.web.ts, which is a stub for previews. */
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// drive.file only reaches files this app created — it cannot see the rest of the user's Drive.
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

let configured = false;
function configure() {
  if (configured) return;
  GoogleSignin.configure({
    scopes: SCOPES,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  configured = true;
}

export const authAvailable = true;

/** Opens the Google account picker. Returns the account email, or null if cancelled. */
export async function signIn(): Promise<string | null> {
  configure();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await GoogleSignin.signIn();
  return res.type === 'success' ? res.data.user.email : null;
}

export async function signOut(): Promise<void> {
  configure();
  await GoogleSignin.signOut();
}

/** A fresh access token for the signed-in account; throws when signed out. */
export async function getAccessToken(): Promise<string> {
  configure();
  if (!GoogleSignin.hasPreviousSignIn()) throw new Error('Not signed in to Google');
  if (!GoogleSignin.getCurrentUser()) await GoogleSignin.signInSilently();
  const { accessToken } = await GoogleSignin.getTokens();
  return accessToken;
}
