/**
 * A close JavaScript translation of `shameempk/pyciede2000` (MIT license)
 *
 * https://github.com/shameempk/pyciede2000/tree/1f6e210683f7b52c4cfb1c9fec80ac3620ddfa3c
 */

const { abs: fabs, cos, exp, pow, sin, sqrt } = Math;

function degrees(rad: number): number {
  return rad * (180 / Math.PI);
}

function radians(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Exception raised for invalid color values.
 */
class InvalidColorValues extends Error {
  tuple: any[];

  /**
   * Exception raised for invalid color values.
   *
   * @param tuple input tuple which caused the error
   * @param message explanation of the error
   */
  constructor(
    tuple: any[],
    message = "Tuple not in valid (L*, a*, b*) format"
  ) {
    super(message);
    this.name = "InvalidColorValues";
    this.tuple = tuple;
  }

  toString(): string {
    return `${this.tuple} -> ${this.message}`;
  }
}

/**
 * Exception raised for invalid L*a*b* values.
 */
class InvalidLabValues extends Error {
  lab: number;

  /**
   * Exception raised for invalid L*a*b* values.
   *
   * @param lab input lab which caused the error
   * @param message explanation of the error
   */
  constructor(
    lab: number,
    message = "Value not in valid L*a*b* color space. L*: 0..100 a*: -128..127 b*: -128..127"
  ) {
    super(message);
    this.name = "InvalidLabValues";
    this.lab = lab;
  }

  toString(): string {
    return `${this.lab} -> ${this.message}`;
  }
}

/**
 * This function return calculated CIEDE2000 color difference value of two input Lab color space elements.
 *
 * @param lab1 Lab representation of colour 1 as a tuple.
 * @param lab2 Lab representation of colour 2 as a tuple.
 * @param k_L Para-metric  weighting  factor kL.
 * @param k_C Para-metric  weighting  factor kC.
 * @param k_H Para-metric  weighting  factor kH.
 * @returns CIEDE2000 color difference of provided colors.
 */
export function ciede2000(
  lab1: [number, number, number],
  lab2: [number, number, number],
  k_L = 1,
  k_C = 1,
  k_H = 1
): {
  a_1_dash: number;
  a_2_dash: number;
  C_1_dash: number;
  C_2_dash: number;
  h_1_dash: number;
  h_2_dash: number;
  h_bar_dash: number;
  G: number;
  T: number;
  S_L: number;
  S_H: number;
  S_C: number;
  R_T: number;
  delta_E_00: number;
} {
  // Error handling
  for (const color of [lab1, lab2]) {
    // Check for length of input
    if (color.length != 3) {
      throw new InvalidColorValues(color);
    }
    // Make sure L* value is in range 0 to 100
    if (color[0] < 0 || color[0] > 100) {
      throw new InvalidLabValues(color[0]);
    }
    // Make sure a* and b* is in range -128 to 127
    for (const ab of color.slice(1)) {
      if (ab < -128 || ab > 127) {
        throw new InvalidLabValues(ab);
      }
    }
  }

  const [L_1_star, a_1_star, b_1_star] = lab1;
  const [L_2_star, a_2_star, b_2_star] = lab2;
  const C_1_star = sqrt(pow(a_1_star, 2) + pow(b_1_star, 2));
  const C_2_star = sqrt(pow(a_2_star, 2) + pow(b_2_star, 2));
  const C_bar_star = (C_1_star + C_2_star) / 2;

  const G =
    0.5 * (1 - sqrt(pow(C_bar_star, 7) / (pow(C_bar_star, 7) + pow(25, 7))));

  const a_1_dash = (1 + G) * a_1_star;
  const a_2_dash = (1 + G) * a_2_star;
  const C_1_dash = sqrt(pow(a_1_dash, 2) + pow(b_1_star, 2));
  const C_2_dash = sqrt(pow(a_2_dash, 2) + pow(b_2_star, 2));
  let h_1_dash = degrees(Math.atan2(b_1_star, a_1_dash));
  h_1_dash += h_1_dash < 0 ? 360 : 0;
  let h_2_dash = degrees(Math.atan2(b_2_star, a_2_dash));
  h_2_dash += h_2_dash < 0 ? 360 : 0;

  const delta_L_dash = L_2_star - L_1_star;
  const delta_C_dash = C_2_dash - C_1_dash;
  let delta_h_dash = 0.0;

  if (C_1_dash * C_2_dash) {
    if (fabs(h_2_dash - h_1_dash) <= 180) {
      delta_h_dash = h_2_dash - h_1_dash;
    } else if (h_2_dash - h_1_dash > 180) {
      delta_h_dash = h_2_dash - h_1_dash - 360;
    } else if (h_2_dash - h_1_dash < -180) {
      delta_h_dash = h_2_dash - h_1_dash + 360;
    }
  }

  const delta_H_dash =
    2 * sqrt(C_1_dash * C_2_dash) * sin(radians(delta_h_dash) / 2.0);

  const L_bar_dash = (L_1_star + L_2_star) / 2;
  const C_bar_dash = (C_1_dash + C_2_dash) / 2;
  let h_bar_dash = h_1_dash + h_2_dash;

  if (C_1_dash * C_2_dash) {
    if (fabs(h_1_dash - h_2_dash) <= 180) {
      h_bar_dash = (h_1_dash + h_2_dash) / 2;
    } else {
      if (h_1_dash + h_2_dash < 360) {
        h_bar_dash = (h_1_dash + h_2_dash + 360) / 2;
      } else {
        h_bar_dash = (h_1_dash + h_2_dash - 360) / 2;
      }
    }
  }

  const T =
    1 -
    0.17 * cos(radians(h_bar_dash - 30)) +
    0.24 * cos(radians(2 * h_bar_dash)) +
    0.32 * cos(radians(3 * h_bar_dash + 6)) -
    0.2 * cos(radians(4 * h_bar_dash - 63));

  const delta_theta = 30 * exp(-pow((h_bar_dash - 275) / 25, 2));

  const R_c = 2 * sqrt(pow(C_bar_dash, 7) / (pow(C_bar_dash, 7) + pow(25, 7)));

  const S_L =
    1 + (0.015 * pow(L_bar_dash - 50, 2)) / sqrt(20 + pow(L_bar_dash - 50, 2));
  const S_C = 1 + 0.045 * C_bar_dash;
  const S_H = 1 + 0.015 * C_bar_dash * T;
  const R_T = -R_c * sin(2 * radians(delta_theta));

  const delta_E_00 = sqrt(
    pow(delta_L_dash / (k_L * S_L), 2) +
      pow(delta_C_dash / (k_C * S_C), 2) +
      pow(delta_H_dash / (k_H * S_H), 2) +
      R_T * (delta_C_dash / (k_C * S_C)) * (delta_H_dash / (k_H * S_H))
  );

  const res = {
    a_1_dash: a_1_dash,
    a_2_dash: a_2_dash,
    C_1_dash: C_1_dash,
    C_2_dash: C_2_dash,
    h_1_dash: h_1_dash,
    h_2_dash: h_2_dash,
    h_bar_dash: h_bar_dash,
    G: G,
    T: T,
    S_L: S_L,
    S_H: S_H,
    S_C: S_C,
    R_T: R_T,
    delta_E_00: delta_E_00,
  };
  return res;
}
