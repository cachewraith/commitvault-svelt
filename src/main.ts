import { mount } from 'svelte';
import './styles/app.css';
import App from './App.svelte';
import { setUnauthorizedHandler } from '$lib/api/client';
import { installPanelLinks, registerPanelRoutes, router } from '$lib/router';
import { bootstrapSession, endSession } from '$features/auth/session';
import { notFoundRoute, panelRoutes, routes } from './routes';

// A 401 from any non-auth endpoint means the session expired or was revoked:
// drop client state; the route guard in App.svelte then redirects to /login.
setUnauthorizedHandler(() => endSession());

router.start(routes, notFoundRoute);
// Record links open in the side panel (once the signed-in layout mounts its host).
registerPanelRoutes(panelRoutes);
installPanelLinks();
void bootstrapSession();

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app mount point');

mount(App, { target });
