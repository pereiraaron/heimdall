import { Response, NextFunction } from "express";
import { ApiKeyRequest } from "../types";
import { clearProjectConfigCache, getProjectByApiKey } from "../services/projectConfig";

export const validateApiKey = async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    res.status(401).json({ message: "API key is required" });
    return;
  }

  try {
    const project = await getProjectByApiKey(apiKey);
    if (!project) {
      res.status(401).json({ message: "Invalid API key" });
      return;
    }

    req.projectId = project.id;
    // Downstream handlers reuse this instead of re-reading the project.
    req.project = project;
    next();
  } catch (error) {
    res.status(500).json({ message: "API key validation failed" });
  }
};

/** Clears the cached project lookups — useful in tests. */
export const clearApiKeyCache = () => {
  clearProjectConfigCache();
};
