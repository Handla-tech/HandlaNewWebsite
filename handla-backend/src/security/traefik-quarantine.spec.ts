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
    // www redirect must be preserved in middleware chain
    expect(middlewares).toContain('handla-www-redirect');
    expect(middlewares.indexOf('handla-www-redirect')).toBeLessThan(
      middlewares.indexOf('handla-quarantine'),
    );
  });

  it('should detect missing middleware when simulated', () => {
    const fakeLabels: Record<string, string> = {
      'traefik.http.routers.handla-api.rule': 'Host(`api.handla.tech`)',
      // Missing middlewares key
    };
    const { hasQuarantine } = validateQuarantine(fakeLabels, 'handla-api');
    expect(hasQuarantine).toBe(false);
  });

  it('should detect incorrect IP allowlist when simulated', () => {
    const fakeLabels: Record<string, string> = {
      'traefik.http.routers.handla-api.rule': 'Host(`api.handla.tech`)',
      'traefik.http.routers.handla-api.middlewares': 'handla-quarantine',
      'traefik.http.middlewares.handla-quarantine.ipallowlist.sourcerange': '0.0.0.0/0',
    };
    const { sourcerange } = validateQuarantine(fakeLabels, 'handla-api');
    expect(sourcerange).not.toBe('127.0.0.1/32');
  });

  it('should detect unprotected alternate routers when simulated', () => {
    const fakeLabels: Record<string, string> = {
      'traefik.http.routers.handla-api.rule': 'Host(`api.handla.tech`)',
      'traefik.http.routers.handla-api.middlewares': 'handla-quarantine',
      'traefik.http.middlewares.handla-quarantine.ipallowlist.sourcerange': '127.0.0.1/32',
      // Unprotected alternate router
      'traefik.http.routers.handla-api-bypass.rule': 'Host(`api.handla.tech`) && Path(`/api/health`)',
    };

    const routers = findRouters(fakeLabels);
    expect(routers).toContain('handla-api-bypass');

    const unprotected = routers.filter((r) => {
      const mw = fakeLabels[`traefik.http.routers.${r}.middlewares`] || '';
      return !mw.split(',').map((s) => s.trim()).includes('handla-quarantine');
    });

    expect(unprotected).toEqual(['handla-api-bypass']);
  });

  it('should verify that all routers currently in docker-compose.traefik.yml are protected', () => {
    const services = ['api', 'web'];
    for (const svc of services) {
      const labels = parsedDoc?.services?.[svc]?.labels || [];
      const labelMap: Record<string, string> = {};
      for (const item of labels) {
        const idx = item.indexOf('=');
        if (idx !== -1) {
          labelMap[item.slice(0, idx)] = item.slice(idx + 1);
        }
      }

      const routers = findRouters(labelMap);
      expect(routers.length).toBeGreaterThan(0);

      for (const router of routers) {
        const mw = labelMap[`traefik.http.routers.${router}.middlewares`] || '';
        const mws = mw.split(',').map((s) => s.trim());
        expect(mws).toContain('handla-quarantine');
      }
    }
  });

  it('should verify that fail-closed behavior works if quarantine configuration is missing', () => {
    const validateConfig = (cfg: any) => {
      const apiMw = cfg.services?.api?.labels?.['traefik.http.routers.handla-api.middlewares'] || '';
      const webMw = cfg.services?.web?.labels?.['traefik.http.routers.handla-web.middlewares'] || '';
      const allowlist = cfg.services?.api?.labels?.['traefik.http.middlewares.handla-quarantine.ipallowlist.sourcerange'] || '';

      const apiOk = apiMw.split(',').map((s: string) => s.trim()).includes('handla-quarantine');
      const webOk = webMw.split(',').map((s: string) => s.trim()).includes('handla-quarantine');
      const allowOk = allowlist === '127.0.0.1/32';

      if (!apiOk || !webOk || !allowOk) {
        throw new Error('FATAL: Traefik Phase 1 quarantine validation failed.');
      }
      return true;
    };

    // Valid case
    expect(() =>
      validateConfig({
        services: {
          api: {
            labels: {
              'traefik.http.routers.handla-api.middlewares': 'handla-quarantine',
              'traefik.http.middlewares.handla-quarantine.ipallowlist.sourcerange': '127.0.0.1/32',
            },
          },
          web: {
            labels: {
              'traefik.http.routers.handla-web.middlewares': 'handla-www-redirect,handla-quarantine',
            },
          },
        },
      }),
    ).not.toThrow();

    // Invalid / missing case
    expect(() =>
      validateConfig({
        services: {
          api: { labels: {} },
          web: { labels: {} },
        },
      }),
    ).toThrow('FATAL: Traefik Phase 1 quarantine validation failed.');
  });
});
