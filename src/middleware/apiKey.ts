import { Response, NextFunction } from "express";
import { Project } from "@models";
import { ApiKeyRequest } from "@types";

export const validateApiKey = async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    res.status(401).json({ message: "API key is required" });
    return;
  }

  try {
    const project = await Project.findOne({ apiKey });
    if (!project) {
      res.status(401).json({ message: "Invalid API key" });
      return;
    }

    req.projectId = project._id.toString();
    next();
  } catch (error) {
    res.status(500).json({ message: "API key validation failed" });
  }
};
