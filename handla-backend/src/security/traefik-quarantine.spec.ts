import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

describe('Traefik Phase 1 Quarantine Configuration Tests', () => {
  const traefikComposePath = path.resolve(
    __dirname,
    '../../../deploy/docker-compose.traefik.yml',
  );

  let rawYaml: string;
  let parsedDoc: any;

  beforeAll(() => {
    rawYaml = fs.readFileSync(traefikComposePath, 'utf8');
    parsedDoc = yaml.load(rawYaml);
  });

  function validateQuarantine(labels: Record<string, string>, routerName: string) {
    const mwKey = `traefik.http.routers.${routerName}.middlewares`;
    const middlewares = labels[mwKey] ? labels[mwKey].split(',').map((s) => s.trim()) : [];
    const hasQuarantine = middlewares.includes('handla-quarantine');

    const allowlistKey = 'traefik.http.middlewares.handla-quarantine.ipallowlist.sourcerange';
    const sourcerange = labels[allowlistKey];

    return {
      hasQuarantine,
      sourcerange,
      middlewares,
    };
  }

  function findRouters(labels: Record<string, string>) {
    return Object.keys(labels)
      .filter((k) => k.startsWith('traefik.http.routers.') && k.endsWith('.rule'))
      .map((k) => k.replace('traefik.http.routers.', '').replace('.rule', ''));
  }

  /**
   * Mirrors the exact logic executed inside section 8b of handla-production-deploy
   */
  function runDeterministicValidator(cfg: any) {
    if (!cfg || typeof cfg !== 'object') {
      throw new Error('Empty Docker Compose configuration JSON received.');
    }
    const services = cfg.services || {};

    const api = services.api;
    const web = services.web;
    if (!api || !web) {
      throw new Error('Missing api or web service definition in rendered compose config.');
    }

    const apiLabels = api.labels || {};
    const webLabels = web.labels || {};

    const expectedAllow = '127.0.0.1/32';
    const apiAllowed = apiLabels['traefik.http.middlewares.handla-quarantine.ipallowlist.sourcerange'];
    const webAllowed = webLabels['traefik.http.middlewares.handla-quarantine.ipallowlist.sourcerange'];

    if (apiAllowed !== expectedAllow) {
      throw new Error(
        `api service middleware handla-quarantine sourcerange mismatch: expected "${expectedAllow}", got "${apiAllowed}"`,
      );
    }

    if (webAllowed !== expectedAllow) {
      throw new Error(
        `web service middleware handla-quarantine sourcerange mismatch: expected "${expectedAllow}", got "${webAllowed}"`,
      );
    }

    for (const [svcName, labels] of [['api', apiLabels], ['web', webLabels]]) {
      const routerNames = Object.keys(labels)
        .filter((k) => k.startsWith('traefik.http.routers.') && k.endsWith('.rule'))
        .map((k) => k.replace('traefik.http.routers.', '').replace('.rule', ''));

      if (routerNames.length === 0) {
        throw new Error(`No Traefik routers found on ${svcName} service.`);
      }

      for (const router of routerNames) {
        const mwKey = `traefik.http.routers.${router}.middlewares`;
        const mwValue = labels[mwKey] || '';
        const mws = mwValue.split(',').map((s: string) => s.trim()).filter(Boolean);
        if (!mws.includes('handla-quarantine')) {
          throw new Error(
            `Router "${router}" on service "${svcName}" lacks required "handla-quarantine" middleware.`,
          );
        }
      }
    }

    const webMainMw = webLabels['traefik.http.routers.handla-web.middlewares'] || '';
    const webMws = webMainMw.split(',').map((s: string) => s.trim());
    if (!webMws.includes('handla-www-redirect')) {
      throw new Error('handla-web router is missing required handla-www-redirect middleware.');
    }

    return true;
  }

  it('should have handla-api router configured with valid quarantine middleware and 127.0.0.1/32 sourcerange', () => {
    const apiLabels = parsedDoc?.services?.api?.labels || [];
    const labelMap: Record<string, string> = {};
    for (const item of apiLabels) {
      const idx = item.indexOf('=');
      if (idx !== -1) {
        labelMap[item.slice(0, idx)] = item.slice(idx + 1);
      }
    }

    const { hasQuarantine, sourcerange } = validateQuarantine(labelMap, 'handla-api');
    expect(hasQuarantine).toBe(true);
    expect(sourcerange).toBe('127.0.0.1/32');
  });

  it('should have handla-web router configured with valid quarantine middleware and preserve www redirect', () => {
    const webLabels = parsedDoc?.services?.web?.labels || [];
    const labelMap: Record<string, string> = {};
    for (const item of webLabels) {
      const idx = item.indexOf('=');
      if (idx !== -1) {
        labelMap[item.slice(0, idx)] = item.slice(idx + 1);
      }
    }

    const { hasQuarantine, middlewares } = validateQuarantine(labelMap, 'handla-web');
    expect(hasQuarantine).toBe(true);
    expect(middlewares).toContain('handla-www-redirect');
    expect(middlewares.indexOf('handla-www-redirect')).toBeLessThan(
      middlewares.indexOf('handla-quarantine'),
    );
  });

  it('should pass the deterministic validator on the actual repo compose configuration', () => {
    const convertLabels = (list: string[]) => {
      const map: Record<string, string> = {};
      for (const item of list) {
        const idx = item.indexOf('=');
        if (idx !== -1) map[item.slice(0, idx)] = item.slice(idx + 1);
      }
      return map;
    };

    const simulatedConfig = {
      services: {
        api: { labels: convertLabels(parsedDoc?.services?.api?.labels || []) },
        web: { labels: convertLabels(parsedDoc?.services?.web?.labels || []) },
      },
    };

    expect(() => runDeterministicValidator(simulatedConfig)).not.toThrow();
  });

  it('should fail closed when web middleware allowlist is missing', () => {
    const configWithMissingWebAllowlist = {
      services: {
        api: {
          labels: {
            'traefik.http.routers.handla-api.rule': 'Host(`api.handla.tech`)',
            'traefik.http.routers.handla-api.middlewares': 'handla-quarantine',
            'traefik.http.middlewares.handla-quarantine.ipallowlist.sourcerange': '127.0.0.1/32',
          },
        },
        web: {
          labels: {
            'traefik.http.routers.handla-web.rule': 'Host(`handla.tech`)',
            'traefik.http.routers.handla-web.middlewares': 'handla-www-redirect,handla-quarantine',
            // Missing allowlist on web
          },
        },
      },
    };

    expect(() => runDeterministicValidator(configWithMissingWebAllowlist)).toThrow(
      'web service middleware handla-quarantine sourcerange mismatch: expected "127.0.0.1/32", got "undefined"',
    );
  });

  it('should fail closed when allowlists conflict or differ from approved 127.0.0.1/32', () => {
    const configWithConflictingAllowlist = {
      services: {
        api: {
          labels: {
            'traefik.http.routers.handla-api.rule': 'Host(`api.handla.tech`)',
            'traefik.http.routers.handla-api.middlewares': 'handla-quarantine',
            'traefik.http.middlewares.handla-quarantine.ipallowlist.sourcerange': '127.0.0.1/32',
          },
        },
        web: {
          labels: {
            'traefik.http.routers.handla-web.rule': 'Host(`handla.tech`)',
            'traefik.http.routers.handla-web.middlewares': 'handla-www-redirect,handla-quarantine',
            'traefik.http.middlewares.handla-quarantine.ipallowlist.sourcerange': '10.0.0.1/32',
          },
        },
      },
    };

    expect(() => runDeterministicValidator(configWithConflictingAllowlist)).toThrow(
      'web service middleware handla-quarantine sourcerange mismatch: expected "127.0.0.1/32", got "10.0.0.1/32"',
    );
  });

  it('should fail closed when an unprotected alternate router is declared', () => {
    const configWithAlternateRouter = {
      services: {
        api: {
          labels: {
            'traefik.http.routers.handla-api.rule': 'Host(`api.handla.tech`)',
            'traefik.http.routers.handla-api.middlewares': 'handla-quarantine',
            'traefik.http.routers.handla-api-bypass.rule': 'Host(`api.handla.tech`) && Path(`/public`)',
            // No middlewares attached to handla-api-bypass
            'traefik.http.middlewares.handla-quarantine.ipallowlist.sourcerange': '127.0.0.1/32',
          },
        },
        web: {
          labels: {
            'traefik.http.routers.handla-web.rule': 'Host(`handla.tech`)',
            'traefik.http.routers.handla-web.middlewares': 'handla-www-redirect,handla-quarantine',
            'traefik.http.middlewares.handla-quarantine.ipallowlist.sourcerange': '127.0.0.1/32',
          },
        },
      },
    };

    expect(() => runDeterministicValidator(configWithAlternateRouter)).toThrow(
      'Router "handla-api-bypass" on service "api" lacks required "handla-quarantine" middleware.',
    );
  });

  it('should fail closed on invalid or malformed JSON input', () => {
    expect(() => runDeterministicValidator(null)).toThrow('Empty Docker Compose configuration JSON received.');
    expect(() => runDeterministicValidator({})).toThrow(
      'Missing api or web service definition in rendered compose config.',
    );
  });

  it('should fail closed if www redirect is omitted on web', () => {
    const configWithoutRedirect = {
      services: {
        api: {
          labels: {
            'traefik.http.routers.handla-api.rule': 'Host(`api.handla.tech`)',
            'traefik.http.routers.handla-api.middlewares': 'handla-quarantine',
            'traefik.http.middlewares.handla-quarantine.ipallowlist.sourcerange': '127.0.0.1/32',
          },
        },
        web: {
          labels: {
            'traefik.http.routers.handla-web.rule': 'Host(`handla.tech`)',
            'traefik.http.routers.handla-web.middlewares': 'handla-quarantine',
            'traefik.http.middlewares.handla-quarantine.ipallowlist.sourcerange': '127.0.0.1/32',
          },
        },
      },
    };

    expect(() => runDeterministicValidator(configWithoutRedirect)).toThrow(
      'handla-web router is missing required handla-www-redirect middleware.',
    );
  });

  describe('Deployment Failure-Safety and Cleanup Procedure Tests', () => {
    type ContainerStatus =
      | 'running'
      | 'exited'
      | 'not_found'
      | 'restarting'
      | 'paused'
      | 'created'
      | 'removing'
      | 'dead'
      | 'unknown';

    interface SimulatedContainer {
      name: string;
      status: ContainerStatus;
      inspectFails?: boolean;
    }

    interface DeploySimulationState {
      containers: Record<string, SimulatedContainer>;
      appDeployInProgress: boolean;
      appCleanupExecuted: boolean;
      cleanupCallCount: number;
      logs: string[];
      errors: string[];
    }

    function createSimulation(initialContainers: Record<string, ContainerStatus>) {
      const state: DeploySimulationState = {
        containers: {},
        appDeployInProgress: false,
        appCleanupExecuted: false,
        cleanupCallCount: 0,
        logs: [],
        errors: [],
      };
      for (const [name, status] of Object.entries(initialContainers)) {
        state.containers[name] = { name, status };
      }
      return state;
    }

    function runCleanup(
      state: DeploySimulationState,
      incomingExit: number = 0,
      failToStop: boolean = false,
    ): { exitCode: number } {
      if (state.appCleanupExecuted) {
        return { exitCode: incomingExit };
      }

      state.cleanupCallCount += 1;

      if (state.appDeployInProgress) {
        state.appCleanupExecuted = true;
        state.appDeployInProgress = false;
        state.logs.push('CRITICAL / FAILURE: Initiating strict application container cleanup...');

        if (!failToStop) {
          if (state.containers['handla_api'] && state.containers['handla_api'].status !== 'not_found') {
            state.containers['handla_api'].status = 'exited';
          }
          if (state.containers['handla_web'] && state.containers['handla_web'].status !== 'not_found') {
            state.containers['handla_web'].status = 'exited';
          }
        }

        const apiCont = state.containers['handla_api'];
        const webCont = state.containers['handla_web'];

        const apiStatus: string = apiCont?.inspectFails ? 'not_found' : (apiCont?.status || 'not_found');
        const webStatus: string = webCont?.inspectFails ? 'not_found' : (webCont?.status || 'not_found');

        const apiSafe = apiStatus === 'exited' || apiStatus === 'not_found';
        const webSafe = webStatus === 'exited' || webStatus === 'not_found';

        if (!apiSafe || !webSafe) {
          state.errors.push(
            `CRITICAL: Failed to verify safe container shutdown! handla_api: ${apiStatus}, handla_web: ${webStatus}`,
          );
          return { exitCode: 99 };
        }

        state.logs.push('Application containers confirmed in safe stopped state ✓');
        state.logs.push('Core stateful services (handla_mysql, handla_redis) preserved untouched ✓');
      }

      return { exitCode: incomingExit };
    }

    it('should stop application containers when docker compose up fails partially', () => {
      const state = createSimulation({
        handla_mysql: 'running',
        handla_redis: 'running',
        handla_api: 'running',
        handla_web: 'not_found',
      });

      state.appDeployInProgress = true;
      const res = runCleanup(state, 8);

      expect(res.exitCode).toBe(8);
      expect(state.containers['handla_api'].status).toBe('exited');
      expect(state.containers['handla_web'].status).toBe('not_found');
      expect(state.containers['handla_mysql'].status).toBe('running');
      expect(state.containers['handla_redis'].status).toBe('running');
      expect(state.appDeployInProgress).toBe(false);
    });

    it('should stop application containers when health verification fails', () => {
      const state = createSimulation({
        handla_mysql: 'running',
        handla_redis: 'running',
        handla_api: 'running',
        handla_web: 'running',
      });

      state.appDeployInProgress = true;
      const res = runCleanup(state, 8);

      expect(res.exitCode).toBe(8);
      expect(state.containers['handla_api'].status).toBe('exited');
      expect(state.containers['handla_web'].status).toBe('exited');
      expect(state.containers['handla_mysql'].status).toBe('running');
      expect(state.containers['handla_redis'].status).toBe('running');
    });

    it('should handle SIGINT with exit code 130 and clean up', () => {
      const state = createSimulation({
        handla_mysql: 'running',
        handla_redis: 'running',
        handla_api: 'running',
        handla_web: 'running',
      });

      state.appDeployInProgress = true;
      const res = runCleanup(state, 130);

      expect(res.exitCode).toBe(130);
      expect(state.containers['handla_api'].status).toBe('exited');
      expect(state.containers['handla_web'].status).toBe('exited');
    });

    it('should handle SIGTERM with exit code 143 and clean up', () => {
      const state = createSimulation({
        handla_mysql: 'running',
        handla_redis: 'running',
        handla_api: 'running',
        handla_web: 'running',
      });

      state.appDeployInProgress = true;
      const res = runCleanup(state, 143);

      expect(res.exitCode).toBe(143);
      expect(state.containers['handla_api'].status).toBe('exited');
      expect(state.containers['handla_web'].status).toBe('exited');
    });

    it('should handle SIGHUP with exit code 129 and clean up', () => {
      const state = createSimulation({
        handla_mysql: 'running',
        handla_redis: 'running',
        handla_api: 'running',
        handla_web: 'running',
      });

      state.appDeployInProgress = true;
      const res = runCleanup(state, 129);

      expect(res.exitCode).toBe(129);
      expect(state.containers['handla_api'].status).toBe('exited');
      expect(state.containers['handla_web'].status).toBe('exited');
    });

    it('should prevent duplicate cleanup execution across multiple traps', () => {
      const state = createSimulation({
        handla_mysql: 'running',
        handla_redis: 'running',
        handla_api: 'running',
        handla_web: 'running',
      });

      state.appDeployInProgress = true;
      const res1 = runCleanup(state, 130);
      const res2 = runCleanup(state, 130);

      expect(res1.exitCode).toBe(130);
      expect(res2.exitCode).toBe(130);
      expect(state.cleanupCallCount).toBe(1); // second call returned immediately
    });

    it('should reject restarting state as unsafe and exit 99', () => {
      const state = createSimulation({
        handla_mysql: 'running',
        handla_redis: 'running',
        handla_api: 'restarting',
        handla_web: 'exited',
      });

      state.appDeployInProgress = true;
      const res = runCleanup(state, 8, true);

      expect(res.exitCode).toBe(99);
      expect(state.errors[0]).toContain('Failed to verify safe container shutdown!');
      expect(state.errors[0]).toContain('handla_api: restarting');
    });

    it('should reject paused state as unsafe and exit 99', () => {
      const state = createSimulation({
        handla_mysql: 'running',
        handla_redis: 'running',
        handla_api: 'exited',
        handla_web: 'paused',
      });

      state.appDeployInProgress = true;
      const res = runCleanup(state, 8, true);

      expect(res.exitCode).toBe(99);
      expect(state.errors[0]).toContain('handla_web: paused');
    });

    it('should reject unknown state as unsafe and exit 99', () => {
      const state = createSimulation({
        handla_mysql: 'running',
        handla_redis: 'running',
        handla_api: 'unknown',
        handla_web: 'exited',
      });

      state.appDeployInProgress = true;
      const res = runCleanup(state, 8, true);

      expect(res.exitCode).toBe(99);
      expect(state.errors[0]).toContain('handla_api: unknown');
    });

    it('should handle docker inspect failure cleanly when container does not exist', () => {
      const state = createSimulation({
        handla_mysql: 'running',
        handla_redis: 'running',
        handla_api: 'not_found',
        handla_web: 'not_found',
      });
      state.containers['handla_api'].inspectFails = true;
      state.containers['handla_web'].inspectFails = true;

      state.appDeployInProgress = true;
      const res = runCleanup(state, 8);

      expect(res.exitCode).toBe(8);
      expect(state.logs).toContain('Application containers confirmed in safe stopped state ✓');
    });

    it('should NOT trigger cleanup on a successful deployment', () => {
      const state = createSimulation({
        handla_mysql: 'running',
        handla_redis: 'running',
        handla_api: 'running',
        handla_web: 'running',
      });

      state.appDeployInProgress = true;
      // Verification succeeds -> deploy is disarmed
      state.appDeployInProgress = false;

      const res = runCleanup(state, 0);

      expect(res.exitCode).toBe(0);
      expect(state.containers['handla_api'].status).toBe('running');
      expect(state.containers['handla_web'].status).toBe('running');
      expect(state.logs).not.toContain(
        'CRITICAL / FAILURE: Initiating strict application container cleanup...',
      );
    });
  });
});
