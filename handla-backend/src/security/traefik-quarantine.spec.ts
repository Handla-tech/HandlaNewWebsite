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
});
