// Key-art capture for the title screen: the real game, a real hero, a cinematic camera, no HUD. Output: public/art/title-*.jpg candidates.
//   KA='x,z,yawDeg,pitchDeg,zoom,fov,shiftRight(m),height(m),heroTurnDeg'  (hero faces the camera turned by heroTurnDeg) node tools/shot.mjs out.png --script tools/e2e/keyart.mjs --size 1920x1080 --wait 3000 --query "e2e=1&autostart=belfry&seed=keyart&fixed=1&quality=ultra"
export default async function ({ page, wait, shot }) {
  const ka = (process.env.KA ?? '8,-28,50,18,12,36,0,1.2,-25').split(',').map(Number);
  const out = process.env.KA_OUT ?? 'artifacts/shots/keyart.png';
  await page.addStyleTag({ content: '#ui, #hud, #panels, .toast, .hint-pop { display: none !important; } canvas#overlay { display: none !important; }' });
  await page.evaluate(([x, z, yaw, pitch, zoom, fov, shift, height, turn]) => {
    const g = window.__game, p = g.player, w = g.world, rad = (d) => d * Math.PI / 180;
    for (const e of w.entities) if (e.team === 'enemy') { e.dead = true; e.removed = true; }
    p.x = x; p.z = z; p.yaw = rad(yaw + turn); p.stats.add('godmode', [{ stat: 'life', op: 'flat', value: 99999 }]);
    g.rig.initialised = false; g.rig.yaw = rad(yaw); g.rig.pitch = rad(pitch); g.rig.zoom = g.rig.zoomTarget = zoom;
    g.scene3d.camera.fov = fov; g.scene3d.camera.updateProjectionMatrix();
    const rx = Math.cos(rad(yaw)), rz = -Math.sin(rad(yaw));            // camera-right on the ground
    g.rig.update = ((orig) => function (dt, focus, aim, t) { return orig.call(this, dt, { x: focus.x + rx * shift, y: focus.y + height, z: focus.z + rz * shift }, null, t); })(g.rig.update);
    g.ui.closeAll();
  }, ka);
  await wait(2500);
  if (/\.jpe?g$/.test(out)) await page.screenshot({ path: out, type: 'jpeg', quality: 84, timeout: 300000 }); else await shot(out);
}
