'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {displacement,TRANSITION_MS}=require('../../docs/desktop-pet-motion.js');
test('sitting leg motion has a ten-second continuous period and does not distort the face',()=>{
  const mode={pose:'sitting',activity:'awake'};
  const a=displacement(.69,.84,2.5,mode),b=displacement(.69,.84,7.5,mode),face=displacement(.52,.20,2.5,mode);
  assert.ok(Math.abs(a.x-b.x)>.025);assert.ok(Math.abs(face.x)<.00001);
  const start=displacement(.69,.84,0,mode),end=displacement(.69,.84,60,mode);
  assert.ok(Math.abs(start.x-end.x)<1e-10);assert.ok(TRANSITION_MS>=1000);
});
test('happy tail motion continues independently while feet and face remain calm',()=>{
  const mode={pose:'sitting',activity:'happy',elapsed:10};
  const a=displacement(.22,.79,.7,mode),b=displacement(.22,.79,2.1,mode),foot=displacement(.83,.94,.7,mode);
  assert.ok(Math.abs(a.x-b.x)>.04);assert.ok(Math.abs(foot.x)<.0005);
});
test('reduced motion disables all displacements, and sleep tail motion stays gentle',()=>{
  assert.deepEqual(displacement(.22,.79,2,{activity:'happy',reducedMotion:true}),{x:0,y:0});
  assert.ok(Math.abs(displacement(.22,.79,2,{activity:'sleeping'}).x)<.0021);
});
test('toe taps alternate feet and the tail follows the same four-second beat',()=>{
  const first={activity:'tapping',elapsed:5},second={activity:'tapping',elapsed:7};
  const leftA=displacement(.75,.93,10,first),rightA=displacement(.91,.93,10,first);
  const leftB=displacement(.75,.93,10,second),rightB=displacement(.91,.93,10,second);
  assert.ok(leftA.y<rightA.y-.012);assert.ok(rightB.y<leftB.y-.012);
  assert.ok(displacement(.22,.79,10,first).x>.015);
  assert.ok(displacement(.22,.79,10,second).x<-.015);
  assert.ok(Math.abs(displacement(.51,.20,10,first).x)<.00001);
});
test('tapping starts and finishes gently, repeats its beat, and respects reduced motion',()=>{
  const a=displacement(.75,.93,10,{activity:'tapping',elapsed:5});
  const b=displacement(.75,.93,10,{activity:'tapping',elapsed:9});
  assert.deepEqual(a,b);
  const end=displacement(.75,.93,10,{activity:'tapping',elapsed:24});
  const near=displacement(.75,.93,10,{activity:'tapping',elapsed:23.999});
  assert.ok(Math.abs(end.y-near.y)<1e-7);
  for(const activity of ['tapping','summer'])assert.deepEqual(displacement(.75,.93,10,{activity,elapsed:5,reducedMotion:true}),{x:0,y:0});
});
