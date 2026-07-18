import * as Keychain from 'react-native-keychain';

const SERVICE_NAME = 'me.social-square.auth';

export async function setSecureToken(token: string): Promise<boolean> {
  try {
    await Keychain.setGenericPassword('auth_token', token, {
      service: SERVICE_NAME,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return true;
  } catch (error) {
    console.error('[SecureStore] Failed to save token:', error);
    return false;
  }
}

export async function getSecureToken(): Promise<string | null> {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: SERVICE_NAME,
    });
    if (credentials && credentials.password) {
      return credentials.password;
    }
    return null;
  } catch (error) {
    console.error('[SecureStore] Failed to retrieve token:', error);
    return null;
  }
}

export async function clearSecureToken(): Promise<boolean> {
  try {
    await Keychain.resetGenericPassword({
      service: SERVICE_NAME,
    });
    return true;
  } catch (error) {
    console.error('[SecureStore] Failed to clear token:', error);
    return false;
  }
}
