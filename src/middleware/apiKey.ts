import { Response, NextFunction } from "express";
import { Project } from "../models";
import { ApiKeyRequest } from "../types";
import { createTtlCache } from "../utils/ttlCache";

const API_KEY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const apiKeyCache = createTtlCache<string>(API_KEY_CACHE_TTL_MS);

export const validateApiKey = async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    res.status(401).json({ message: "API key is required" });
    return;
  }

  try {
    const cachedProjectId = apiKeyCache.get(apiKey);
    if (cachedProjectId) {
      req.projectId = cachedProjectId;
      next();
      return;
    }

    const project = await Project.findOne({ apiKey }).select("_id").lean();
    if (!project) {
      res.status(401).json({ message: "Invalid API key" });
      return;
    }

    const projectId = project._id.toString();
    apiKeyCache.set(apiKey, projectId);
    req.projectId = projectId;
    next();
  } catch (error) {
    res.status(500).json({ message: "API key validation failed" });
  }
};

/** Clears the API key cache — useful in tests. */
export const clearApiKeyCache = () => {
  apiKeyCache.clear();
};
