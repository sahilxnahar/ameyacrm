import { describe, it, expect } from 'vitest';
import { scoreRecord, summariseQuality, ifscCheck, gstinCheck, phoneCheck } from '@/lib/dataquality/score';

describe('scoreRecord', () => {
  const required = ['name', 'phone', 'gstin', 'bankIfsc'];

  it('is 100 and grade A when every required field is present and valid', () => {
    const r = scoreRecord('1', 'Acme', { name: 'Acme', phone: '9876543210', gstin: '29ABCDE1234F1Z5', bankIfsc: 'HDFC0001234' }, required, [phoneCheck, gstinCheck, ifscCheck]);
    expect(r.score).toBe(100);
    expect(r.grade).toBe('A');
    expect(r.missing).toHaveLength(0);
    expect(r.issues).toHaveLength(0);
  });

  it('docks completeness for each missing required field', () => {
    const r = scoreRecord('1', 'Acme', { name: 'Acme', phone: '9876543210' }, required);
    expect(r.score).toBe(50); // 2 of 4 present
    expect(r.missing).toEqual(['gstin', 'bankIfsc']);
  });

  it('treats an empty string as missing', () => {
    const r = scoreRecord('1', 'Acme', { name: 'Acme', phone: '  ', gstin: '', bankIfsc: 'HDFC0001234' }, required);
    expect(r.missing).toContain('phone');
    expect(r.missing).toContain('gstin');
  });

  it('penalises a present-but-malformed IFSC harder than a blank one', () => {
    const blank = scoreRecord('1', 'A', { name: 'A', phone: '9876543210', gstin: '29ABCDE1234F1Z5' }, required, [ifscCheck]);
    const wrong = scoreRecord('2', 'B', { name: 'B', phone: '9876543210', gstin: '29ABCDE1234F1Z5', bankIfsc: 'KKBK00008556' }, required, [ifscCheck]);
    // KKBK00008556 is 12 chars — the exact bug from the handover.
    expect(wrong.issues.length).toBe(1);
    expect(wrong.score).toBeLessThan(blank.score);
  });

  it('flags the 12-character IFSC as wrong and accepts a valid 11-character one', () => {
    expect(ifscCheck.isWrong('KKBK00008556')).toBe(true);   // 12 chars
    expect(ifscCheck.isWrong('KKBK0000855')).toBe(false);   // 11 chars, valid shape
  });
});

describe('summariseQuality', () => {
  it('averages scores, buckets grades, and lists the worst first', () => {
    const results = [
      scoreRecord('1', 'Full', { name: 'x', phone: '9876543210' }, ['name', 'phone']),      // 100
      scoreRecord('2', 'Half', { name: 'x' }, ['name', 'phone']),                            // 50
      scoreRecord('3', 'None', {}, ['name', 'phone']),                                       // 0
    ];
    const s = summariseQuality(results);
    expect(s.count).toBe(3);
    expect(s.averageScore).toBe(50);
    expect(s.grades.A).toBe(1); // 100
    expect(s.grades.C).toBe(1); // 50
    expect(s.grades.D).toBe(1); // 0
    expect(s.worst[0]!.label).toBe('None'); // worst first
    expect(s.worst.map((w) => w.label)).not.toContain('Full'); // perfect records excluded
  });
});
