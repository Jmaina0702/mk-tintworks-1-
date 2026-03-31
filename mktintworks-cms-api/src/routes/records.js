import { createProtectedPlaceholderHandler } from "./protected.js";

export const handleRecordsRequest = createProtectedPlaceholderHandler(
  "Records dashboard",
  ["GET"]
);
