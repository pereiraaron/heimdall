import { Project } from "../models";
import { IProjectSocialProviders, PasskeyPolicy, ProjectConfig } from "../types";
import { createTtlCache } from "../utils/ttlCache";

const PROJECT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const INVALID_API_KEY_TTL_MS = 30 * 1000; // 30 seconds

/** Every field any request handler needs — fetched once, cached, reused. */
const PROJECT_FIELDS = "name passkeyPolicy webauthnRpIds webauthnOrigins socialProviders";

const byApiKey = createTtlCache<ProjectConfig>(PROJECT_CACHE_TTL_MS);
const byId = createTtlCache<ProjectConfig>(PROJECT_CACHE_TTL_MS);

// Short-lived negative cache so a flood of bogus API keys can't hammer the DB.
const invalidApiKeys = createTtlCache<true>(INVALID_API_KEY_TTL_MS);

type RawProject = {
  _id: { toString: () => string };
  name?: string;
  passkeyPolicy?: PasskeyPolicy;
  webauthnRpIds?: string[];
  webauthnOrigins?: string[];
  socialProviders?: IProjectSocialProviders;
};

const toConfig = (project: RawProject): ProjectConfig => ({
  id: project._id.toString(),
  name: project.name,
  passkeyPolicy: project.passkeyPolicy,
  webauthnRpIds: project.webauthnRpIds,
  webauthnOrigins: project.webauthnOrigins,
  socialProviders: project.socialProviders,
});

export const getProjectByApiKey = async (apiKey: string): Promise<ProjectConfig | null> => {
  const cached = byApiKey.get(apiKey);
  if (cached) return cached;
  if (invalidApiKeys.get(apiKey)) return null;

  const project = (await Project.findOne({ apiKey })
    .select(PROJECT_FIELDS)
    .lean()) as RawProject | null;

  if (!project) {
    invalidApiKeys.set(apiKey, true);
    return null;
  }

  const config = toConfig(project);
  byApiKey.set(apiKey, config);
  // Seed the id cache too — handlers downstream look the project up by id.
  byId.set(config.id, config);
  return config;
};

export const getProjectById = async (projectId: string): Promise<ProjectConfig | null> => {
  const cached = byId.get(projectId);
  if (cached) return cached;

  const project = (await Project.findById(projectId)
    .select(PROJECT_FIELDS)
    .lean()) as RawProject | null;

  if (!project) return null;

  const config = toConfig(project);
  byId.set(projectId, config);
  return config;
};

/** Clears all cached project state — useful in tests and after project updates. */
export const clearProjectConfigCache = () => {
  byApiKey.clear();
  byId.clear();
  invalidApiKeys.clear();
};
