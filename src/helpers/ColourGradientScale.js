import { HA_COLOURS } from "../const.js";
import { isNumber } from "./utilities.js";

export class ColourGradientScale {
  // internal grad scale representation
  // array of { value, colour }
  #grad = [];
  // scaling end points for raw values
  #minValue;
  #maxValue;
  // scale the grad to constrained endpoints if required
  #gradStart;
  #gradEnd;
  #isSingleColour = false;

  constructor(gradDef, scaleDef = {}) {
    if (gradDef.constructor == Object) {
      // gradDef is a dictionary, so build the grad array
      // Store the scale definitions
      this.#gradStart = scaleDef.gradStart || 0;
      this.#gradEnd = scaleDef.gradEnd || 100;
      this.#minValue = scaleDef.minValue || 0;
      this.#maxValue = scaleDef.maxValue || 100;

      // Map and store the grad
      for (const [val, col] of Object.entries(gradDef)) {
        // convert % entries to raw values if needed
        const rawValue = val.endsWith("%")
          ? this.#minValue +
            (parseFloat(val) / 100.0) * (this.#maxValue - this.#minValue)
          : parseFloat(val);
        // apply HA colours if supplied
        const colour = HA_COLOURS[col] || col;
        // scale and add to the grad array
        this.#grad.push({
          value: this.#scaleToGrad(rawValue),
          colour: colour,
        });
      }
      // Sort the grad in case the definition was out of order
      this.#grad.sort((a, b) => a.value - b.value);
      // Extend the grad to 0% and 100% by repeating end point colours if needed
      if (this.#grad[0] > 0) {
        this.#grad.unshift({ value: 0, colour: this.#grad[0].colour });
      }
      if (this.#grad.at(-1) < 100) {
        this.#grad.push({ value: 100, colour: this.#grad.at(-1).colour });
      }
    } else {
      // gradDef is a block colour, so treat as such
      this.#isSingleColour = true;
      this.#grad = HA_COLOURS[gradDef] || gradDef;
    }
  }

  #scaleToGrad(rawValue) {
    // convert the rawValue to % on the grad, constrained to the operating
    // of the grad
    return (
      this.#gradStart +
      ((parseFloat(rawValue) - this.#minValue) /
        (this.#maxValue - this.#minValue)) *
        (this.#gradEnd - this.#gradStart)
    );
  }

  getConicGradientCss(opacity = 1) {
    // if we've just got a single colour, just return it
    if (this.#isSingleColour) {
      return `background: color-mix(in srgb, ${
        this.#grad
      } var(--rt-ring-background-opacity, ${100.0 * opacity}%), transparent);`;
    }
    // build the gradient
    const gradCSS = this.#grad.map((grad) => {
      return `color-mix(in srgb, ${grad.colour} var(--rt-ring-background-opacity, ${
        100.0 * opacity
      }%), transparent) ${grad.value}%`;
    });
    // return the full CSS
    return `background-image: conic-gradient(
        from 180deg,
        ${gradCSS.join(", ")}
      );
    `;
  }

  getSolidColourAtGradPct(gradPct) {
    // convert the angle to a value on the grad
    const rawValue =
      this.#minValue +
      ((gradPct - this.#gradStart) / (this.#gradEnd - this.#gradStart)) *
        (this.#maxValue - this.#minValue);
    // get the colour at that value
    return this.getSolidColour(rawValue);
  }

  getSolidColour(rawValue) {
    // default to zero if no value supplied
    if (!isNumber(rawValue)) {
      rawValue = 0;
    }
    // is it a single colour?
    if (this.#isSingleColour) {
      return this.#grad;
    }
    // are we out of range?
    if (this.#scaleToGrad(rawValue) < this.#grad[0].value) {
      return this.#grad[0].colour;
    }
    if (this.#scaleToGrad(rawValue) > this.#grad.at(-1).value) {
      return this.#grad.at(-1).colour;
    }

    // mix a colour from the grad at rawValue
    const gradValue = this.#scaleToGrad(rawValue);
    // is it a direct match?
    const entry = this.#grad.find((g) => g.value === gradValue);
    if (entry) {
      return entry.colour;
    }
    const lowEntry = this.#grad.findLast((g) => g.value < gradValue);
    const highEntry = this.#grad.find((g) => g.value > gradValue);
    // are the two entries the same?
    if (lowEntry.colour === highEntry.colour) {
      return lowEntry.colour;
    }
    // ok, mix a colour
    const ratio =
      (100.0 * (gradValue - lowEntry.value)) /
      (highEntry.value - lowEntry.value);
    return `color-mix(in srgb,
        ${lowEntry.colour} ${100 - ratio}%,
        ${highEntry.colour} ${ratio}%
      )
    `;
  }
}
