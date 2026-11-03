import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';
// Full-app tests load real route and dialog chunks, including cold transforms on Windows.
configure({ asyncUtilTimeout: 5000 });
afterEach(cleanup);
