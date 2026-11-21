const FOV = 34;
const SCALE_FACTOR = 2 * Math.tan((FOV * Math.PI) / 360);

export function computeLayout(width, height) {
  const mobile = width <= 760;
  const tablet = width > 760 && width <= 1180;
  // A phone or tablet held sideways has too little vertical room for the
  // stacked portrait composition. Use a side-by-side arrangement instead:
  // copy on the left, object on the right.
  const shortLandscape = height <= 520 && width > height * 1.15;
  const tightLandscape = shortLandscape && height <= 380;

  let widthFraction;
  let heightFraction;
  let centerFraction;
  let viewOffset;
  let yaw;
  let pitch;

  if (shortLandscape) {
    widthFraction = 0.4;
    heightFraction = tightLandscape ? 0.46 : 0.58;
    centerFraction = tightLandscape ? 0.48 : 0.47;
    viewOffset = 0.155;
    yaw = 0.44;
    pitch = 0.33;
  } else if (tablet) {
    widthFraction = 0.66;
    heightFraction = 0.48;
    centerFraction = 0.545;
    viewOffset = 0;
    yaw = 0.48;
    pitch = 0.33;
  } else if (mobile) {
    // Short phones spend a fixed amount of height on the title, telemetry and
    // dock. Shrink and raise the object slightly so it never collides with the
    // fixed UI above it.
    const short = height < 720;
    widthFraction = 0.84;
    heightFraction = short ? 0.32 : 0.39;
    centerFraction = short ? 0.54 : 0.555;
    viewOffset = 0;
    yaw = 0.4;
    pitch = 0.34;
  } else {
    widthFraction = 0.37;
    heightFraction = 0.55;
    centerFraction = 0.5;
    viewOffset = 0.052;
    yaw = 0.52;
    pitch = 0.32;
  }

  const desiredWidth = Math.min(width * widthFraction, height * heightFraction);
  const projectedWidth = 4.25;
  const distance = (projectedWidth * height) / (SCALE_FACTOR * desiredWidth);
  const pixelsPerWorld = height / (SCALE_FACTOR * distance);

  const centerPixels = height * centerFraction;
  const stageY =
    mobile || tablet || shortLandscape
      ? -(centerPixels - height / 2) / pixelsPerWorld
      : 0;

  return {
    fov: FOV,
    distance,
    minDistance: distance * 0.72,
    maxDistance: distance * 1.46,
    yaw,
    pitch,
    stageX: 0,
    stageY,
    viewOffsetX: width * viewOffset,
    centerFraction,
    mobile,
    tablet,
    desktop: !mobile && !tablet,
  };
}
