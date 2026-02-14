import { getStringArray, setStringArray, setJSON, getJSON, storage } from '../storage';

const templatesKey = (userId: string) => `relay:pendingTemplates:${userId}`;
const templatePayloadKey = (userId: string, id: string) => `relay:pendingTemplatePayload:${userId}:${id}`;

export function enqueuePendingTemplate(userId: string, id: string, payload: any) {
  const q = getStringArray(templatesKey(userId));
  if (!q.includes(id)) q.push(id);
  setStringArray(templatesKey(userId), q);
  setJSON(templatePayloadKey(userId, id), payload);
}

export function listPendingTemplates(userId: string) {
  return getStringArray(templatesKey(userId));
}

export function getPendingTemplatePayload(userId: string, id: string) {
  return getJSON<any>(templatePayloadKey(userId, id));
}

export function dequeuePendingTemplate(userId: string, id: string) {
  const q = getStringArray(templatesKey(userId)).filter((x) => x !== id);
  setStringArray(templatesKey(userId), q);
  localStorage.removeItem(templatePayloadKey(userId, id));
}