import { describe, it, expect } from 'vitest';
import { sanitise } from '@/lib/automation/sanitise';

const good = {
  name: 'Chase new enquiries',
  description: 'Assigns and raises a call task.',
  trigger: 'LEAD_CREATED',
  matchAll: true,
  conditions: [{ field: 'source', op: 'contains', value: 'portal' }],
  actions: [{ type: 'CREATE_TASK', params: { title: 'Call them', dueInDays: 1, priority: 'HIGH' } }],
};

describe('sanitise', () => {
  it('passes a valid rule through', () => {
    const r = sanitise(good);
    expect(r).not.toHaveProperty('error');
    if ('error' in r) return;
    expect(r.trigger).toBe('LEAD_CREATED');
    expect(r.actions).toHaveLength(1);
    expect(r.notes).toEqual([]);
  });

  it('refuses an invented trigger', () => {
    expect(sanitise({ ...good, trigger: 'PAYMENT_RECEIVED' })).toHaveProperty('error');
  });

  it('drops an invented action and says so', () => {
    const r = sanitise({ ...good, actions: [{ type: 'SEND_WHATSAPP', params: {} }, ...good.actions] });
    if ('error' in r) throw new Error('should not have failed outright');
    expect(r.actions.map((a) => a.type)).toEqual(['CREATE_TASK']);
    expect(r.notes.join(' ')).toContain('SEND_WHATSAPP');
  });

  it('fails when nothing runnable is left, rather than saving a rule that does nothing', () => {
    const r = sanitise({ ...good, actions: [{ type: 'SEND_WHATSAPP', params: {} }] });
    expect(r).toHaveProperty('error');
  });

  it('drops a condition on a field the trigger cannot see', () => {
    const r = sanitise({ ...good, conditions: [{ field: 'paymentAmount', op: 'gt', value: '5' }] });
    if ('error' in r) throw new Error('should not have failed outright');
    expect(r.conditions).toEqual([]);
    expect(r.notes.join(' ')).toContain('paymentAmount');
  });

  it('drops an operator the engine does not implement', () => {
    const r = sanitise({ ...good, conditions: [{ field: 'source', op: 'regex', value: '.*' }] });
    if ('error' in r) throw new Error('should not have failed outright');
    expect(r.conditions).toEqual([]);
  });

  it('strips parameters the action does not take', () => {
    const r = sanitise({
      ...good,
      actions: [{ type: 'CREATE_TASK', params: { title: 'x', nonsense: 'y', userId: 'made-up' } }],
    });
    if ('error' in r) throw new Error('should not have failed outright');
    expect(Object.keys(r.actions[0]!.params)).toEqual(['title']);
  });

  it('warns when a required parameter is missing instead of silently accepting it', () => {
    const r = sanitise({ ...good, actions: [{ type: 'ASSIGN_USER', params: {} }] });
    if ('error' in r) throw new Error('should not have failed outright');
    expect(r.notes.join(' ')).toMatch(/needs userId/i);
  });

  it('rejects junk', () => {
    expect(sanitise(null)).toHaveProperty('error');
    expect(sanitise('hello')).toHaveProperty('error');
    expect(sanitise({})).toHaveProperty('error');
  });
});
