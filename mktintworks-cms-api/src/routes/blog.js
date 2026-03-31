import { createProtectedPlaceholderHandler } from "./protected.js";

export const handleBlogRequest = createProtectedPlaceholderHandler(
  "Blog system"
);
