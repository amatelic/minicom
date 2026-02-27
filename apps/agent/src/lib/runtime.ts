import {
  SupabaseMessageRepository,
  SupabaseRealtimeGateway,
  createSupabaseBrowserClient,
} from "@minicom/chat-core";

export const AGENT_ID = "agent-demo";

let repository: SupabaseMessageRepository | null = null;

const getRepository = (): SupabaseMessageRepository => {
  if (!repository) {
    repository = new SupabaseMessageRepository(createSupabaseBrowserClient());
  }

  return repository;
};

export const getAgentRepository = (): SupabaseMessageRepository => {
  return getRepository();
};

export const createAgentSupabaseClient = () => {
  return createSupabaseBrowserClient();
};

export const createAgentGateway = (): SupabaseRealtimeGateway => {
  return new SupabaseRealtimeGateway(createSupabaseBrowserClient(), AGENT_ID);
};
