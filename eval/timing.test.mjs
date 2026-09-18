// Tests for reading the Server-Timing header and summarising stages across a run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseServerTiming, summariseStages } from './timing.mjs';

test('parses durations and call counts', () => {
  const stages = parseServerTiming('classify;dur=812.4;desc="2 calls", parse;dur=903.1, total;dur=5120.0');
  assert.deepEqual(stages.classify, { ms: 812.4, calls: 2 });
  assert.deepEqual(stages.parse, { ms: 903.1, calls: 1 });
  assert.equal(stages.total.ms, 5120);
});

test('a missing or malformed header yields no stages rather than an error', () => {
  assert.deepEqual(parseServerTiming(null), {});
  assert.deepEqual(parseServerTiming('classify;desc="x"'), {});
});

test('summary counts only requests that ran a stage and keeps pipeline order', () => {
  const rows = [
    { stages: { classify: { ms: 100, calls: 1 }, chat: { ms: 300, calls: 1 }, total: { ms: 500, calls: 1 } } },
    { stages: { classify: { ms: 300, calls: 2 }, rerank: { ms: 900, calls: 1 }, total: { ms: 1500, calls: 1 } } },
    { stages: {} },
  ];
  const summary = summariseStages(rows);
  assert.equal(summary.requests, 2);
  assert.deepEqual(summary.stages.map(s => s.name), ['classify', 'rerank', 'chat', 'total']);
  const classify = summary.stages.find(s => s.name === 'classify');
  assert.equal(classify.ran, 2);
  assert.equal(classify.callsPerRequest, 1.5);
  assert.equal(summary.stages.find(s => s.name === 'rerank').ran, 1);
});
