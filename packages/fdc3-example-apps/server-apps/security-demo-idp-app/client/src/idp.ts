// IDP App Client — mirrors fdc3-security/samples/get-user-example.ts (IDP side)
import { DesktopAgent, Context, ContextMetadata } from '@finos/fdc3';
import { connectRemoteHandlers, type FDC3Handlers } from '@finos/fdc3-security';
import { createLogEntry, updateStatus, clearLog } from '../../../../common/src/security-demo/logging';
import { initializeFDC3 } from '../../../../common/src/security-demo/fdc3';
import {
  setupLogoutButton,
  setupSessionStatusButton,
  showAuthenticatedState,
  type UserSessionContext,
} from '../../../../common/src/security-demo/session-logic';

const CREATE_IDENTITY_TOKEN = 'CreateIdentityToken';

function wsUrlForPage(): string {
  return (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host;
}

async function setupLoginButton(handlers: FDC3Handlers): Promise<void> {
  const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
  loginBtn.addEventListener('click', async () => {
    try {
      const result = await handlers.exchangeData('user-request', {
        type: 'fdc3.security.userRequest',
      });

      if (result && (result as Context).type === 'fdc3.security.user') {
        showAuthenticatedState(result as UserSessionContext);
        createLogEntry('success', 'Login successful', result);
      } else {
        createLogEntry('success', 'User Logged out', ``);
        showAuthenticatedState(null);
      }
    } catch (error) {
      console.error('Session error:', error);
      createLogEntry('error', 'Session Error', (error as Error).message);
      throw error;
    }
  });
}

async function setupCreateIdentityTokenListener(fdc3: DesktopAgent, handlers: FDC3Handlers): Promise<void> {
  const intentHandler = await handlers.remoteIntentHandler(CREATE_IDENTITY_TOKEN);

  await fdc3.addIntentListener(CREATE_IDENTITY_TOKEN, async (context: Context, metadata: ContextMetadata | undefined) => {
    createLogEntry('info', `${CREATE_IDENTITY_TOKEN} intent received`, context);
    const ss = await intentHandler(context, metadata);
    createLogEntry('success', `${CREATE_IDENTITY_TOKEN} intent result`, ss);
    return ss;
  });
}

async function initialize(): Promise<void> {
  const fdc3 = await initializeFDC3();

  connectRemoteHandlers(wsUrlForPage(), fdc3, async () => {}).then(async remoteHandlers => {
    setupSessionStatusButton(remoteHandlers);
    setupLogoutButton(remoteHandlers);
    await setupLoginButton(remoteHandlers);
    showAuthenticatedState(null);
    await setupCreateIdentityTokenListener(fdc3, remoteHandlers);

    createLogEntry('info', 'IDP App Initialized', 'Application ready');
  });
}

(window as unknown as { clearLog: typeof clearLog; updateStatus: typeof updateStatus }).clearLog = clearLog;
(window as unknown as { clearLog: typeof clearLog; updateStatus: typeof updateStatus }).updateStatus = updateStatus;

document.addEventListener('DOMContentLoaded', initialize);
