import mongoose from "mongoose";
import { connectToDB, resetDbConnectionState } from "../connect";

jest.mock("mongoose", () => ({
  connect: jest.fn(),
  connection: { readyState: 0 },
}));

describe("Database Connection", () => {
  const originalEnv = process.env;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalProcessExit = process.exit;

  beforeEach(() => {
    jest.clearAllMocks();
    resetDbConnectionState();
    (mongoose.connection as { readyState: number }).readyState = 0;
    console.log = jest.fn();
    console.error = jest.fn();
    process.exit = jest.fn() as any;
    process.env = {
      ...originalEnv,
      CONNECTION_STRING: "mongodb://test-connection-string",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });

  const expectedOptions = {
    maxPoolSize: 5,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    autoIndex: false,
  };

  it("should connect to MongoDB successfully", async () => {
    (mongoose.connect as jest.Mock).mockResolvedValueOnce(undefined);

    await connectToDB();

    expect(mongoose.connect).toHaveBeenCalledWith(
      "mongodb://test-connection-string",
      expectedOptions
    );
    expect(console.log).toHaveBeenCalledWith("🟢 MongoDB connected");
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("should skip connect when already connected", async () => {
    (mongoose.connection as { readyState: number }).readyState = 1;

    await connectToDB();

    expect(mongoose.connect).not.toHaveBeenCalled();
  });

  it("should log and rethrow on connection failure so the caller can decide", async () => {
    const testError = new Error("Connection error");
    (mongoose.connect as jest.Mock).mockRejectedValueOnce(testError);

    await expect(connectToDB()).rejects.toThrow("Connection error");

    expect(mongoose.connect).toHaveBeenCalledWith(
      "mongodb://test-connection-string",
      expectedOptions
    );
    expect(console.error).toHaveBeenCalledWith("🔴 MongoDB connection error:", testError);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("should allow a retry after a failed connection", async () => {
    (mongoose.connect as jest.Mock).mockRejectedValueOnce(new Error("Connection error"));
    await expect(connectToDB()).rejects.toThrow("Connection error");

    (mongoose.connect as jest.Mock).mockResolvedValueOnce(undefined);
    await expect(connectToDB()).resolves.toBeUndefined();

    expect(mongoose.connect).toHaveBeenCalledTimes(2);
  });
});
