import { mount } from 'svelte';
import './styles/app.css';
import App from './App.svelte';
import { setUnauthorizedHandler } from '$lib/api/client';
import { router } from '$lib/router';
import { bootstrapSession, endSession } from '$features/auth/session';
import { notFoundRoute, routes } from './routes';

// A 401 from any non-auth endpoint means the session expired or was revoked:
// drop client state; the route guard in App.svelte then redirects to /login.
setUnauthorizedHandler(() => endSession());

router.start(routes, notFoundRoute);
void bootstrapSession();

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app mount point');

mount(App, { target });
