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

  describe('First-Deployment and Rollback Baseline Simulation Tests', () => {
    interface BaselineSimulationConfig {
      existingContainers: {
        handla_api: { status: 'running' | 'exited' | 'not_found'; imageId?: string };
        handla_web: { status: 'running' | 'exited' | 'not_found'; imageId?: string };
      };
      dockerStorageImages: string[];
      rollbackMetadata?: {
        status?: string;
        active_api_image?: string;
        active_web_image?: string;
        known_good_api_image?: string;
        known_good_web_image?: string;
      } | null;
      backupMarkerExists?: boolean;
      backupMarkerContent?: string;
      backupMetaContent?: string;
      backupMeta?: {
        ts?: string;
        db_artifact?: string;
        db_size?: number;
        db_sha256?: string;
        remote?: string;
      } | null;
      quarantineValid?: boolean;
    }

    interface DeployExecutionResult {
      exitCode: number;
      fatalError?: string;
      mode?: 'normal' | 'first_deploy_no_baseline';
      rollbackBaselineRecorded?: {
        status: string;
        active_api: string;
        active_web: string;
        known_good_api: string;
        known_good_web: string;
        previous_api: string | null;
        previous_web: string | null;
      };
      pinnedRollbackTag?: { api: string; web: string };
    }

    function simulateDeployBaseline(
      config: BaselineSimulationConfig,
      candidateImages: { api: string; web: string } = { api: 'sha256:new_api_1', web: 'sha256:new_web_1' },
      healthCheckSucceeds: boolean = true,
    ): DeployExecutionResult {
      // 1. Production quarantine validation check (Step 8b)
      if (config.quarantineValid === false) {
        return {
          exitCode: 5,
          fatalError: 'Traefik Phase 1 quarantine validation failed.',
        };
      }

      const currApiStatus = config.existingContainers.handla_api.status;
      const currWebStatus = config.existingContainers.handla_web.status;

      const candidateApiImage = config.existingContainers.handla_api.imageId;
      const candidateWebImage = config.existingContainers.handla_web.imageId;

      const currApiHealthy = currApiStatus === 'running' && healthCheckSucceeds;
      const currWebHealthy = currWebStatus === 'running' && healthCheckSucceeds;

      const meta = config.rollbackMetadata;
      const lastActiveApi = meta?.active_api_image;
      const lastActiveWeb = meta?.active_web_image;
      const prevGoodApi = meta?.known_good_api_image;
      const prevGoodWeb = meta?.known_good_web_image;

      let rollbackTargetApi = '';
      let rollbackTargetWeb = '';
      let rollbackBaselineStatus = '';
      let firstDeployNoBaseline = false;

      if (currApiHealthy && currWebHealthy && candidateApiImage && candidateWebImage) {
        rollbackTargetApi = candidateApiImage;
        rollbackTargetWeb = candidateWebImage;
        rollbackBaselineStatus = 'live_healthy';
      } else if (lastActiveApi && lastActiveWeb) {
        rollbackTargetApi = lastActiveApi;
        rollbackTargetWeb = lastActiveWeb;
        rollbackBaselineStatus = 'last_verified_active';
      } else if (prevGoodApi && prevGoodWeb) {
        rollbackTargetApi = prevGoodApi;
        rollbackTargetWeb = prevGoodWeb;
        rollbackBaselineStatus = meta?.status || 'persisted_known_good';
      } else if (candidateApiImage && candidateWebImage) {
        const apiExists = config.dockerStorageImages.includes(candidateApiImage);
        const webExists = config.dockerStorageImages.includes(candidateWebImage);

        if (apiExists && webExists) {
          rollbackTargetApi = candidateApiImage;
          rollbackTargetWeb = candidateWebImage;
          rollbackBaselineStatus = 'initial_unverified_baseline';
        } else if (!apiExists && !webExists) {
          // Check eligibility for first-deployment no-baseline mode
          if (currApiStatus === 'running' || currWebStatus === 'running') {
            return {
              exitCode: 9,
              fatalError: 'first-deployment mode rejected: application containers are currently running.',
            };
          }

          if (config.rollbackMetadata || config.rollbackOverrideExists) {
            return {
              exitCode: 9,
              fatalError: 'first-deployment mode rejected: rollback metadata or override exists in /opt/handla-production-rollback, but referenced historical Docker images are missing from local storage.',
            };
          }

          if (config.backupMarkerExists === false) {
            return {
              exitCode: 9,
              fatalError: 'first-deployment mode rejected: database backup marker missing (/var/lib/handla-backup/last-success).',
            };
          }

          // Parse metadata either from raw string or structured object
          let parsedTs: string | undefined;
          let parsedMetaTs: string | undefined;
          let parsedArtifact: string | undefined;
          let parsedSize: string | number | undefined;
          let parsedSha: string | undefined;
          let parsedRemote: string | undefined;

          if (config.backupMetaContent !== undefined) {
            if (config.backupMetaContent === null || config.backupMetaContent === '') {
              return {
                exitCode: 9,
                fatalError: 'first-deployment mode rejected: database backup metadata missing (/var/lib/handla-backup/last-success.meta).',
              };
            }
            const lines = config.backupMetaContent.split('\n');
            const getVal = (prefix: string) => {
              const line = lines.find((l) => l.startsWith(prefix));
              return line ? line.slice(prefix.length).trim() : undefined;
            };
            parsedMetaTs = getVal('ts=');
            parsedArtifact = getVal('db_artifact=');
            parsedSize = getVal('db_size=');
            parsedSha = getVal('db_sha256=');
            parsedRemote = getVal('remote=');
            parsedTs = config.backupMarkerContent?.trim();
          } else if (config.backupMeta) {
            parsedTs = config.backupMeta.ts;
            parsedMetaTs = config.backupMeta.ts;
            parsedArtifact = config.backupMeta.db_artifact;
            parsedSize = config.backupMeta.db_size;
            parsedSha = config.backupMeta.db_sha256;
            parsedRemote = config.backupMeta.remote || 'handla-backups-aws:handla-production-backups/daily/' + config.backupMeta.ts;
          } else {
            return {
              exitCode: 9,
              fatalError: 'first-deployment mode rejected: database backup metadata missing (/var/lib/handla-backup/last-success.meta).',
            };
          }

          if (!parsedTs || !parsedMetaTs || !parsedArtifact || parsedSize === undefined || !parsedSha || !parsedRemote) {
            return {
              exitCode: 9,
              fatalError: 'first-deployment mode rejected: database backup metadata is corrupt or incomplete.',
            };
          }

          if (parsedTs !== parsedMetaTs) {
            return {
              exitCode: 9,
              fatalError: `first-deployment mode rejected: backup marker timestamp ('${parsedTs}') does not match metadata ts ('${parsedMetaTs}').`,
            };
          }

          const sizeNum = typeof parsedSize === 'number' ? parsedSize : parseInt(parsedSize, 10);
          if (isNaN(sizeNum) || sizeNum <= 0 || !/^[1-9][0-9]*$/.test(String(parsedSize))) {
            return {
              exitCode: 9,
              fatalError: `first-deployment mode rejected: database backup size is invalid ('${parsedSize}').`,
            };
          }

          if (!/^[0-9a-fA-F]{64}$/.test(parsedSha)) {
            return {
              exitCode: 9,
              fatalError: `first-deployment mode rejected: database backup SHA256 checksum is invalid ('${parsedSha}').`,
            };
          }

          if (!parsedRemote.startsWith('handla-backups-aws:')) {
            return {
              exitCode: 9,
              fatalError: `first-deployment mode rejected: backup remote ('${parsedRemote}') is not AWS (handla-backups-aws:).`,
            };
          }

          if (!/^handla-backups-aws:.+\/daily\//.test(parsedRemote)) {
            return {
              exitCode: 9,
              fatalError: `first-deployment mode rejected: backup remote prefix is malformed ('${parsedRemote}').`,
            };
          }

          firstDeployNoBaseline = true;
        } else {
          // Asymmetric historical images
          return {
            exitCode: 9,
            fatalError: `asymmetric historical Docker images detected (api_exists=${apiExists}, web_exists=${webExists}).`,
          };
        }
      }

      if (!firstDeployNoBaseline) {
        if (!rollbackTargetApi || !rollbackTargetWeb) {
          return {
            exitCode: 9,
            fatalError: 'no valid rollback target images determined and not eligible for first-deployment mode.',
          };
        }

        if (!config.dockerStorageImages.includes(rollbackTargetApi)) {
          return {
            exitCode: 9,
            fatalError: `rollback target API image '${rollbackTargetApi}' does not exist in local Docker storage.`,
          };
        }
        if (!config.dockerStorageImages.includes(rollbackTargetWeb)) {
          return {
            exitCode: 9,
            fatalError: `rollback target Web image '${rollbackTargetWeb}' does not exist in local Docker storage.`,
          };
        }
      }

      // App deploy and health verification
      if (!healthCheckSucceeds) {
        return {
          exitCode: 8,
          fatalError: 'API or Web health verification failed.',
          mode: firstDeployNoBaseline ? 'first_deploy_no_baseline' : 'normal',
        };
      }

      // Post-verification recording (Step 14)
      if (firstDeployNoBaseline) {
        return {
          exitCode: 0,
          mode: 'first_deploy_no_baseline',
          pinnedRollbackTag: { api: candidateImages.api, web: candidateImages.web },
          rollbackBaselineRecorded: {
            status: 'healthy_verified_initial',
            active_api: candidateImages.api,
            active_web: candidateImages.web,
            known_good_api: candidateImages.api,
            known_good_web: candidateImages.web,
            previous_api: null,
            previous_web: null,
          },
        };
      } else {
        return {
          exitCode: 0,
          mode: 'normal',
          pinnedRollbackTag: { api: rollbackTargetApi, web: rollbackTargetWeb },
          rollbackBaselineRecorded: {
            status: 'healthy_verified',
            active_api: candidateImages.api,
            active_web: candidateImages.web,
            known_good_api: rollbackTargetApi,
            known_good_web: rollbackTargetWeb,
            previous_api: rollbackTargetApi,
            previous_web: rollbackTargetWeb,
          },
        };
      }
    }

    const validBackupMeta = {
      ts: '20261018-030000',
      db_artifact: 'handla-db-prod_20261018-030000.sql.gz.age',
      db_size: 4518290,
      db_sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
      remote: 'handla-backups-aws:handla-production-backups/daily/20261018-030000',
    };

    it('should support eligible first deployment with real production KEY=VALUE backup metadata format', () => {
      const realMetaContent = [
        'ts=20261018-023237',
        'db_artifact=handla-db-prod_20261018-023237.sql.gz.age',
        'db_size=116945',
        'db_sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'remote=handla-backups-aws:handla-production-backups/daily/20261018-023237',
      ].join('\n');

      const res = simulateDeployBaseline({
        existingContainers: {
          handla_api: { status: 'exited', imageId: 'sha256:2da5f2f3e64affeb95c6b760953ba30504a8d4ab87da18d40045aef4acd9cf7f' },
          handla_web: { status: 'exited', imageId: 'sha256:587884954640d5979fe6f4269d293fc4aa8cf432e337ab974ca09209967b8247' },
        },
        dockerStorageImages: ['sha256:new_api_1', 'sha256:new_web_1'], // VPS historical images missing, new built images present
        rollbackMetadata: null,
        rollbackOverrideExists: false,
        backupMarkerExists: true,
        backupMarkerContent: '20261018-023237\n',
        backupMetaContent: realMetaContent,
        quarantineValid: true,
      });

      expect(res.exitCode).toBe(0);
      expect(res.mode).toBe('first_deploy_no_baseline');
      expect(res.rollbackBaselineRecorded?.status).toBe('healthy_verified_initial');
      expect(res.rollbackBaselineRecorded?.active_api).toBe('sha256:new_api_1');
      expect(res.rollbackBaselineRecorded?.previous_api).toBeNull();
      expect(res.pinnedRollbackTag?.api).toBe('sha256:new_api_1');
    });

    it('should fail closed when backup marker timestamp and metadata ts diverge', () => {
      const mismatchedMetaContent = [
        'ts=20261018-023237',
        'db_artifact=handla-db-prod_20261018-023237.sql.gz.age',
        'db_size=116945',
        'db_sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'remote=handla-backups-aws:handla-production-backups/daily/20261018-023237',
      ].join('\n');

      const res = simulateDeployBaseline({
        existingContainers: {
          handla_api: { status: 'exited', imageId: 'sha256:missing_old_api' },
          handla_web: { status: 'exited', imageId: 'sha256:missing_old_web' },
        },
        dockerStorageImages: ['sha256:new_api_1', 'sha256:new_web_1'],
        rollbackMetadata: null,
        rollbackOverrideExists: false,
        backupMarkerExists: true,
        backupMarkerContent: '20261017-999999', // marker differs from metadata
        backupMetaContent: mismatchedMetaContent,
        quarantineValid: true,
      });

      expect(res.exitCode).toBe(9);
      expect(res.fatalError).toContain("backup marker timestamp ('20261017-999999') does not match metadata ts ('20261018-023237')");
    });

    it('should fail closed when remote is non-AWS', () => {
      const nonAwsMetaContent = [
        'ts=20261018-023237',
        'db_artifact=handla-db-prod_20261018-023237.sql.gz.age',
        'db_size=116945',
        'db_sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'remote=minio-test:handla-backups/daily/20261018-023237',
      ].join('\n');

      const res = simulateDeployBaseline({
        existingContainers: {
          handla_api: { status: 'exited', imageId: 'sha256:missing_old_api' },
          handla_web: { status: 'exited', imageId: 'sha256:missing_old_web' },
        },
        dockerStorageImages: ['sha256:new_api_1', 'sha256:new_web_1'],
        rollbackMetadata: null,
        rollbackOverrideExists: false,
        backupMarkerExists: true,
        backupMarkerContent: '20261018-023237',
        backupMetaContent: nonAwsMetaContent,
        quarantineValid: true,
      });

      expect(res.exitCode).toBe(9);
      expect(res.fatalError).toContain('backup remote');
      expect(res.fatalError).toContain('is not AWS');
    });

    it('should fail closed when db_sha256 is malformed or invalid hex', () => {
      const invalidShaMetaContent = [
        'ts=20261018-023237',
        'db_artifact=handla-db-prod_20261018-023237.sql.gz.age',
        'db_size=116945',
        'db_sha256=not_a_valid_sha256',
        'remote=handla-backups-aws:handla-production-backups/daily/20261018-023237',
      ].join('\n');

      const res = simulateDeployBaseline({
        existingContainers: {
          handla_api: { status: 'exited', imageId: 'sha256:missing_old_api' },
          handla_web: { status: 'exited', imageId: 'sha256:missing_old_web' },
        },
        dockerStorageImages: ['sha256:new_api_1', 'sha256:new_web_1'],
        rollbackMetadata: null,
        rollbackOverrideExists: false,
        backupMarkerExists: true,
        backupMarkerContent: '20261018-023237',
        backupMetaContent: invalidShaMetaContent,
        quarantineValid: true,
      });

      expect(res.exitCode).toBe(9);
      expect(res.fatalError).toContain('database backup SHA256 checksum is invalid');
    });

    it('should support eligible first deployment with no historical images', () => {
      const res = simulateDeployBaseline({
        existingContainers: {
          handla_api: { status: 'exited', imageId: 'sha256:missing_old_api' },
          handla_web: { status: 'exited', imageId: 'sha256:missing_old_web' },
        },
        dockerStorageImages: ['sha256:new_api_1', 'sha256:new_web_1'], // old missing, new present
        rollbackMetadata: null,
        rollbackOverrideExists: false,
        backupMarkerExists: true,
        backupMeta: validBackupMeta,
        quarantineValid: true,
      });

      expect(res.exitCode).toBe(0);
      expect(res.mode).toBe('first_deploy_no_baseline');
      expect(res.rollbackBaselineRecorded?.status).toBe('healthy_verified_initial');
      expect(res.rollbackBaselineRecorded?.active_api).toBe('sha256:new_api_1');
      expect(res.rollbackBaselineRecorded?.previous_api).toBeNull();
      expect(res.pinnedRollbackTag?.api).toBe('sha256:new_api_1');
    });

    it('should reject first-deployment mode when existing containers are running', () => {
      const res = simulateDeployBaseline({
        existingContainers: {
          handla_api: { status: 'running', imageId: 'sha256:missing_old_api' },
          handla_web: { status: 'exited', imageId: 'sha256:missing_old_web' },
        },
        dockerStorageImages: ['sha256:new_api_1', 'sha256:new_web_1'],
        rollbackMetadata: null,
        rollbackOverrideExists: false,
        backupMarkerExists: true,
        backupMeta: validBackupMeta,
        quarantineValid: true,
      });

      expect(res.exitCode).toBe(9);
      expect(res.fatalError).toContain('application containers are currently running');
    });

    it('should abort if Traefik Phase 1 quarantine validation fails', () => {
      const res = simulateDeployBaseline({
        existingContainers: {
          handla_api: { status: 'exited', imageId: 'sha256:missing_old_api' },
          handla_web: { status: 'exited', imageId: 'sha256:missing_old_web' },
        },
        dockerStorageImages: ['sha256:new_api_1', 'sha256:new_web_1'],
        rollbackMetadata: null,
        rollbackOverrideExists: false,
        backupMarkerExists: true,
        backupMeta: validBackupMeta,
        quarantineValid: false,
      });

      expect(res.exitCode).toBe(5);
      expect(res.fatalError).toContain('quarantine validation failed');
    });

    it('should reject first-deployment mode when database backup marker is missing', () => {
      const res = simulateDeployBaseline({
        existingContainers: {
          handla_api: { status: 'exited', imageId: 'sha256:missing_old_api' },
          handla_web: { status: 'exited', imageId: 'sha256:missing_old_web' },
        },
        dockerStorageImages: ['sha256:new_api_1', 'sha256:new_web_1'],
        rollbackMetadata: null,
        rollbackOverrideExists: false,
        backupMarkerExists: false,
        backupMeta: validBackupMeta,
        quarantineValid: true,
      });

      expect(res.exitCode).toBe(9);
      expect(res.fatalError).toContain('database backup marker missing');
    });

    it('should reject first-deployment mode when database backup metadata is corrupt or zero size', () => {
      const res = simulateDeployBaseline({
        existingContainers: {
          handla_api: { status: 'exited', imageId: 'sha256:missing_old_api' },
          handla_web: { status: 'exited', imageId: 'sha256:missing_old_web' },
        },
        dockerStorageImages: ['sha256:new_api_1', 'sha256:new_web_1'],
        rollbackMetadata: null,
        rollbackOverrideExists: false,
        backupMarkerExists: true,
        backupMeta: {
          ...validBackupMeta,
          db_size: 0,
        },
        quarantineValid: true,
      });

      expect(res.exitCode).toBe(9);
      expect(res.fatalError).toContain('database backup size is invalid');
    });

    it('should reject deployment when historical images are only partially available', () => {
      const res = simulateDeployBaseline({
        existingContainers: {
          handla_api: { status: 'exited', imageId: 'sha256:existing_old_api' },
          handla_web: { status: 'exited', imageId: 'sha256:missing_old_web' },
        },
        dockerStorageImages: ['sha256:existing_old_api', 'sha256:new_api_1', 'sha256:new_web_1'],
        rollbackMetadata: null,
        rollbackOverrideExists: false,
        backupMarkerExists: true,
        backupMeta: validBackupMeta,
        quarantineValid: true,
      });

      expect(res.exitCode).toBe(9);
      expect(res.fatalError).toContain('asymmetric historical Docker images detected');
    });

    it('should reject first-deployment mode if rollback metadata exists but target images are missing', () => {
      const res = simulateDeployBaseline({
        existingContainers: {
          handla_api: { status: 'exited', imageId: 'sha256:missing_old_api' },
          handla_web: { status: 'exited', imageId: 'sha256:missing_old_web' },
        },
        dockerStorageImages: ['sha256:new_api_1', 'sha256:new_web_1'],
        rollbackMetadata: {
          active_api_image: 'sha256:recorded_api_missing',
          active_web_image: 'sha256:recorded_web_missing',
        },
        rollbackOverrideExists: false,
        backupMarkerExists: true,
        backupMeta: validBackupMeta,
        quarantineValid: true,
      });

      expect(res.exitCode).toBe(9);
      expect(res.fatalError).toContain('rollback target API image');
    });

    it('should abort with exit code 8 if health verification fails during first deployment', () => {
      const res = simulateDeployBaseline(
        {
          existingContainers: {
            handla_api: { status: 'exited', imageId: 'sha256:missing_old_api' },
            handla_web: { status: 'exited', imageId: 'sha256:missing_old_web' },
          },
          dockerStorageImages: ['sha256:new_api_1', 'sha256:new_web_1'],
          rollbackMetadata: null,
          rollbackOverrideExists: false,
          backupMarkerExists: true,
          backupMeta: validBackupMeta,
          quarantineValid: true,
        },
        { api: 'sha256:new_api_1', web: 'sha256:new_web_1' },
        false, // health fails
      );

      expect(res.exitCode).toBe(8);
      expect(res.fatalError).toContain('health verification failed');
    });

    it('should support normal subsequent deployment after a successful first deployment', () => {
      // 1. Run first deployment
      const firstRun = simulateDeployBaseline({
        existingContainers: {
          handla_api: { status: 'exited', imageId: 'sha256:missing_old_api' },
          handla_web: { status: 'exited', imageId: 'sha256:missing_old_web' },
        },
        dockerStorageImages: ['sha256:v1_api', 'sha256:v1_web'],
        rollbackMetadata: null,
        rollbackOverrideExists: false,
        backupMarkerExists: true,
        backupMeta: validBackupMeta,
        quarantineValid: true,
      }, { api: 'sha256:v1_api', web: 'sha256:v1_web' });

      expect(firstRun.exitCode).toBe(0);
      expect(firstRun.mode).toBe('first_deploy_no_baseline');
      const establishedMeta = firstRun.rollbackBaselineRecorded;

      // 2. Second deployment (deploying v2 while v1 is running and healthy)
      const secondRun = simulateDeployBaseline({
        existingContainers: {
          handla_api: { status: 'running', imageId: 'sha256:v1_api' },
          handla_web: { status: 'running', imageId: 'sha256:v1_web' },
        },
        dockerStorageImages: ['sha256:v1_api', 'sha256:v1_web', 'sha256:v2_api', 'sha256:v2_web'],
        rollbackMetadata: {
          status: establishedMeta?.status,
          active_api_image: establishedMeta?.active_api,
          active_web_image: establishedMeta?.active_web,
          known_good_api_image: establishedMeta?.known_good_api,
          known_good_web_image: establishedMeta?.known_good_web,
        },
        rollbackOverrideExists: true,
        backupMarkerExists: true,
        backupMeta: validBackupMeta,
        quarantineValid: true,
      }, { api: 'sha256:v2_api', web: 'sha256:v2_web' });

      expect(secondRun.exitCode).toBe(0);
      expect(secondRun.mode).toBe('normal');
      expect(secondRun.pinnedRollbackTag?.api).toBe('sha256:v1_api');
      expect(secondRun.rollbackBaselineRecorded?.known_good_api).toBe('sha256:v1_api');
      expect(secondRun.rollbackBaselineRecorded?.active_api).toBe('sha256:v2_api');
    });
  });
});
