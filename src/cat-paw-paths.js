// Los recorridos se reproducen en orden, sin dibujar conexiones entre ellos.
// Cada tramo es una curva cúbica con inicio, dos controles y final.
export function catPawRoutes(width, height, origin) {
  const point = (x, y) => ({ x: x * width, y: y * height });
  return [
    [
      // 1: salir de la firma y recorrer la curva de la izquierda.
      [origin, point(.05, .99), point(.03, .89), point(.095, .79)],
      [point(.095, .79), point(.18, .68), point(.18, .59), point(.14, .49)],
      [point(.14, .49), point(.10, .44), point(.06, .44), point(-.02, .49)],
    ],
    [
      // 2: dar la vuelta de la derecha.
      [point(.675, 1.02), point(.675, .85), point(.65, .85), point(.725, .795)],
      [point(.725, .795), point(.79, .735), point(.89, .865), point(.838, .94)],
      [point(.838, .94), point(.79, 1.01), point(.75, .79), point(.785, .75)],
      [point(.785, .75), point(.845, .66), point(.96, .72), point(1.02, .55)],
    ],
    [
      // 3: completar la curva grande y regresar al punto de origen.
      [point(.975, .20), point(.94, .31), point(.91, .38), point(.78, .37)],
      [point(.78, .37), point(.65, .39), point(.52, .30), point(.56, .14)],
      [point(.56, .14), point(.58, .03), point(.66, .08), point(.69, .24)],
      [point(.69, .24), point(.74, .53), point(.58, .56), point(.46, .40)],
      [point(.46, .40), point(.39, .25), point(.35, .12), point(.28, .18)],
      [point(.28, .18), point(.19, .27), point(.22, .45), point(.30, .53)],
      [point(.30, .53), point(.43, .70), point(.41, .87), origin],
    ],
  ];
}

export function catPawSteps(route, stride = 40, separation = 10) {
  const samples = [route[0][0]];
  for (const [start, control1, control2, end] of route) {
    for (let i = 1; i <= 64; i++) {
      const t = i / 64, u = 1 - t;
      samples.push({
        x: u ** 3 * start.x + 3 * u ** 2 * t * control1.x + 3 * u * t ** 2 * control2.x + t ** 3 * end.x,
        y: u ** 3 * start.y + 3 * u ** 2 * t * control1.y + 3 * u * t ** 2 * control2.y + t ** 3 * end.y,
      });
    }
  }
  const steps = [];
  let traveled = 0, nextStep = 0;
  for (let i = 1; i < samples.length; i++) {
    const from = samples[i - 1], to = samples[i];
    const dx = to.x - from.x, dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (!length) continue;
    // Espaciado constante por distancia: no acelera en las partes rectas
    // ni amontona huellas en las curvas. La orientación sigue la tangente.
    while (nextStep <= traveled + length) {
      const t = (nextStep - traveled) / length;
      const side = steps.length % 2 ? separation : -separation;
      steps.push({
        x: from.x + dx * t - dy / length * side,
        y: from.y + dy * t + dx / length * side,
        angle: Math.atan2(dy, dx) * 180 / Math.PI + 90,
      });
      nextStep += stride;
    }
    traveled += length;
  }
  // Llegar exactamente al final, aunque el último paso regular no coincida
  // con el final de la curva por la longitud del recorrido.
  const end = samples.at(-1);
  const previous = samples.at(-2);
  steps.push({ ...end, angle: Math.atan2(end.y - previous.y, end.x - previous.x) * 180 / Math.PI + 90 });
  return steps;
}
