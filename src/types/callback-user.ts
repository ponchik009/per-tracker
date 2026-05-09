export type CallbackUser = {
  id: string;
  timezone: string;
  pets: Array<{ pet: { id: string; isDeleted: boolean } }>;
};
