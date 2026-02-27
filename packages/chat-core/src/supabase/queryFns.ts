import type { EnsureThreadInput, FetchThreadPageInput, MessageRepository, SendMessageInput } from "../protocol";

export const threadMessagesPageQueryFn = (
  repository: Pick<MessageRepository, "fetchThreadPage">,
  input: FetchThreadPageInput,
) => {
  return repository.fetchThreadPage(input);
};

export const agentInboxQueryFn = (
  repository: Pick<MessageRepository, "fetchAgentInbox">,
  input: { agentId: string },
) => {
  return repository.fetchAgentInbox(input);
};

export const ensureThreadMutationFn = (
  repository: Pick<MessageRepository, "ensureThread">,
  input: EnsureThreadInput,
) => {
  return repository.ensureThread(input);
};

export const sendMessageMutationFn = (
  repository: Pick<MessageRepository, "sendMessage">,
  input: SendMessageInput,
) => {
  return repository.sendMessage(input);
};

export const markThreadReadMutationFn = (
  repository: Pick<MessageRepository, "markThreadRead">,
  input: { threadId: string; participantId: string; at: number },
) => {
  return repository.markThreadRead(input);
};
