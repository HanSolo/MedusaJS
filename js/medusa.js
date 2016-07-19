/*
 * Copyright (c) 2016 by Gerrit Grunwald
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

Math.radians = function(degrees) { return degrees * Math.PI / 180; };
Math.degrees = function(radians) { return radians * 180 / Math.PI; };


// ******************** Classes ***********************************************
class Color {
  constructor (r, g, b, a) {
    this._red   = clamp(0, 255, r) || 0;
    this._green = clamp(0, 255, g) || 0;
    this._blue  = clamp(0, 255, b) || 0;
    this._alpha = clamp(0, 1, a)   || 1;
  }

  get red      ()      { return this._red; }
  set red      (red)   { this._red = clamp(0, 255, red); }

  get green    ()      { return this._green; }
  set green    (green) { this._green = clamp(0, 255, green); }

  get blue     ()      { return this._blue; }
  set blue     (blue)  { this._blue = clamp(0, 255, blue); }

  get alpha    ()      { return this._alpha; }
  set alpha    (alpha) { this._alpha = clamp(0, 1, alpha); }

  get asRGB    ()      { return 'rgb(' + this._red + ',' + this._green + ',' + this._blue + ')'; }
  get asRGBA   ()      { return 'rgba(' + this._red + ',' + this._green + ',' + this._blue + ',' + this._alpha + ')'; }
  get asHEX    ()      { return '#' + (0x1000000 + this._blue + 0x100 * this._green + 0x10000 * this._red).toString(16).substr(1); }

  contrast     ()      { return this.isBright() ? new Color(0,0,0) : new Color(255,255,255) }

  distance     (color) {
    var deltaR = (color.red - this._red);
    var deltaG = (color.green - this._green);
    var deltaB = (color.blue - this._blue);
    return Math.sqrt(deltaR * deltaR + deltaG * deltaG + deltaB * deltaB);
  }
  isBright     ()      { return !this.isDark(); }
  isDark       ()      {
    var distanceToWhite = this.distance(new Color(255,255,255));
    var distanceToBlack = this.distance(new Color(0,0,0));
    return distanceToBlack < distanceToWhite;
  }
}

class Stop {
  constructor(offset, color) {
    this._offset = clamp(0, 1, offset) || 0;
    this._color  = color || new Color().rgba(255, 255, 255, 0);
  }

  get offset () { return this._offset; }
  get color  () { return this._color; }
}

class LcdDesign {
  constructor(bg0, bg1, bg2, bg3, bg4, fg, fgt) {
    this._colors             = [bg0, bg1, bg2, bg3, bg4, fg, fgt];
    this._lcdForegroundColor = fg;
    this._lcdBackgroundColor = fgt;
  }
  
  get colors () { return this._colors; }
  
  get lcdForegroundColor () { return this._lcdForegroundColor; }
  
  get lcdBackgroundColor () { return this._lcdBackgroundColor; }
}

class Section {
  constructor(parameters) {
    this._param = parameters || {};
    this._start = this._param.start || 0;
    this._stop  = this._param.stop || 0;
    this._text  = this._param.text || '';
    this._color = this._param.color || 'rgb(200, 100, 0)';
    this._image = this._param.image || '';
  };

  get start () { return this._start; }
  set start (start) { this._start = start; }

  get stop  () { return this._stop; }
  set stop  (stop) { this._stop = stop; }

  get color () { return this._color; }
  set color (color) { this._color = color; }

  get image () { return this._image; }
  set image (image) { this._image = image; }

  contains (value) { return (value >= this._start && value <= this._stop); }
}

class GradientLookup {
  constructor(stops) {
    this._stops = stops || [];
  };

  stops () { return this._stops; }

  getColorAt (positionOfColor) {
      var position = positionOfColor < 0 ? 0 : (positionOfColor > 1 ? 1 : positionOfColor);
      var color;
      if (this._stops.length === 1) {
        if (this._stops[0].offset === undefined) return new Color();
        color = this._stops[0].color;
      } else {
        var lowerBound = this._stops[0];
        var upperBound = this._stops[this._stops.length - 1];
        for (var i = 0 ; i < this._stops.length ; i++) {
          var offset = this._stops[i].offset;
          if (offset < position) {
            lowerBound = this._stops[i];
          }
          if (offset > position) {
            upperBound = this._stops[i];
            break;
          }
        }
        color = this.interpolateColor(lowerBound, upperBound, position);
      }
      return color;
    }
  interpolateColor (lowerBound, upperBound, position) {
      var pos = (position - lowerBound.offset) / (upperBound.offset - lowerBound.offset);

      var deltaRed   = (upperBound.color.red - lowerBound.color.red) * 0.00392 * pos;
      var deltaGreen = (upperBound.color.green - lowerBound.color.green) * 0.00392 * pos;
      var deltaBlue  = (upperBound.color.blue - lowerBound.color.blue) * 0.00392 * pos;
      var deltaAlpha = (upperBound.color.alpha - lowerBound.color.alpha) * pos;

      var red   = parseInt((lowerBound.color.red * 0.00392 + deltaRed) * 255);
      var green = parseInt((lowerBound.color.green * 0.00392 + deltaGreen) * 255);
      var blue  = parseInt((lowerBound.color.blue * 0.00392 + deltaBlue) * 255);
      var alpha = lowerBound.color.alpha + deltaAlpha;

      red   = red < 0 ? 0 : (red > 255 ? 255 : red);
      green = green < 0 ? 0 : (green > 255 ? 255 : green);
      blue  = blue < 0 ? 0 : (blue > 255 ? 255 : blue);
      alpha = alpha < 0 ? 0 : (alpha > 1 ? 1 : alpha);

      return new Color(red, green, blue, alpha);
    }
}

class UpdateEvent {
  constructor (source, type) {
    this._source = source || undefined;
    this._type   = type   || this.EventType.REDRAW;
  }

  get source () { return this._source; }
  get type   () { return this._type; }
}


// ******************** Enums *************************************************
var NeedleType           = Object.freeze({
                                                         BIG       : 'big',
                                                         FAT       : 'fat',
                                                         STANDARD  : 'standard',
                                                         SCIENTIFIC: 'scientific',
                                                         AVIONIC   : 'avionic',
                                                         VARIOMETER: 'variometer'
                                                       });
var NeedleShape          = Object.freeze({
                                                         ANGLED: 'angled',
                                                         ROUND : 'round',
                                                         FLAT  : 'flat'
                                                       });
var NeedleSize           = Object.freeze({
                                                         THIN    : { name: 'thin', factor: 0.015 },
                                                         STANDARD: { name: 'standard', factor: 0.025 },
                                                         THICK   : { name: 'thick', factor: 0.05}
                                                       });
var NeedleBehavior       = Object.freeze({
                                                         STANDARD : 'standard',
                                                         OPTIMIZED: 'optimized'
                                                       });
var KnobType             = Object.freeze({
                                                         STANDARD: 'standard',
                                                         PLAIN   : 'plain',
                                                         METAL   : 'metal',
                                                         FLAT    : 'flat'
                                                       });
var LedType              = Object.freeze({
                                                         STANDARD: 'standard',
                                                         FLAT    : 'flat'
                                                       });
var ScaleDirection       = Object.freeze({
                                                         CLOCKWISE        : 'clockwise',
                                                         COUNTER_CLOCKWISE: 'counterClockwise',
                                                         LEFT_TO_RIGHT    : 'leftToRight',
                                                         RIGHT_TO_LEFT    : 'rightToLeft',
                                                         BOTTOM_TO_TOP    : 'bottomToTop',
                                                         TOP_TO_BOTTOM    : 'topToBottom'
                                                       });
var TickMarkType         = Object.freeze({
                                                         LINE      : 'line',
                                                         DOT       : 'dot',
                                                         TRAPEZOID : 'trapezoid',
                                                         TRIANGLE  : 'triangle',
                                                         BOX       : 'box',
                                                         TICK_LABEL: 'tickLabel',
                                                         PILL      : 'pill'
                                                       });
var TickLabelOrientation = Object.freeze({
                                                         HORIZONTAL: 'horizontal',
                                                         ORTHOGNAL : 'orthogonal',
                                                         TANGENT   : 'tangent'
                                                       });
var TickLabelLocation    = Object.freeze({
                                                         INSIDE : 'inside',
                                                         OUTSIDE: 'outside'
                                                       });
var Orientation          = Object.freeze({
                                                         HORIZONTAL: 'horizontal',
                                                         VERTICAL  : 'vertical'
                                                       });
var Pos                  = Object.freeze({
                                                         TOP_LEFT     : 'topLeft',
                                                         TOP_CENTER   : 'topCenter',
                                                         TOP_RIGHT    : 'topRight',
                                                         CENTER_LEFT  : 'centerLeft',
                                                         CENTER       : 'center',
                                                         CENTER_RIGHT : 'centerRight',
                                                         BOTTOM_LEFT  : 'bottomLeft',
                                                         BOTTOM_CENTER: 'bottomLeft',
                                                         BOTTOM_RIGHT : 'bottomRight'
                                                       });
var NumberFormat         = Object.freeze({
                                                         AUTO      : '0',
                                                         STANDARD  : '0',
                                                         FRACTIONAL: '0.0#',
                                                         SCIENTIFIC: '0.##E0',
                                                         PERCENTAGE: '##0.0%'
                                                       });
var Colors               = Object.freeze({
                                                         WHITE       : new Color(255, 255, 255),
                                                         BLACK       : new Color(0, 0, 0),
                                                         RED         : new Color(255, 0, 0),
                                                         CRIMSON     : new Color(220, 20, 60),
                                                         DARK_COLOR  : new Color(36, 36, 36),
                                                         BRIGHT_COLOR: new Color(223, 223, 223),
                                                         TRANSPARENT : new Color(255, 255, 255, 0)
                                                       });
var LcdDesigns           = Object.freeze({
                                                         BEIGE : new LcdDesign(new Color(200, 200, 177), new Color(241, 237, 207), new Color(234, 230, 194), new Color(225, 220, 183), new Color(237, 232, 191), this.Colors.BLACK, new Color(0, 0, 0, 0.1)),
                                                         BLUE: (this.Colors.WHITE, new Color(231, 246, 255), new Color(170, 224, 255), new Color(136, 212, 255), new Color(192, 232, 255), new Color(18, 69, 100), new Color(18, 69, 100, 0.1)),
                                                         ORANGE: (this.Colors.WHITE, new Color(255, 245, 225), new Color(255, 217, 147), new Color(255, 201, 104), new Color(255, 227, 173), new Color(80, 55, 0), new Color(80, 55, 0, 0.1)),
                                                         RED: (this.Colors.WHITE, new Color(255, 225, 225), new Color(252, 114, 115), new Color(252, 114, 115), new Color(254, 178, 178), new Color(79, 12, 14), new Color(79, 12, 14, 0.1)),
                                                         YELLOW: (this.Colors.WHITE, new Color(245, 255, 186), new Color(158, 205, 0), new Color(158, 205, 0), new Color(210, 255, 0), new Color(64, 83, 0), new Color(64, 83, 0, 0.1)),
                                                         WHITE: (this.Colors.WHITE, this.Colors.WHITE, new Color(241, 246, 242), new Color(229, 239, 244), this.Colors.WHITE, this.Colors.BLACK, new Color(0, 0, 0, 0.1)),
                                                         GRAY: (new Color(65, 65, 65), new Color(117, 117, 117), new Color(87, 87, 87), new Color(65, 65, 65), new Color(81, 81, 81), this.Colors.WHITE, new Color(255, 255, 255, 0.1)),
                                                         BLACK: (new Color(65, 65, 65), new Color(102, 102, 102), new Color(51, 51, 51), this.Colors.BLACK, new Color(51, 51, 51), new Color(204, 204, 204), new Color(204, 204, 204, 0.1)),
                                                         GREEN: (new Color(33, 67, 67), new Color(33, 67, 67), new Color(29, 58, 58), new Color(28, 57, 57), new Color(23, 46, 46), new Color(0, 185, 165), new Color(0, 185, 165, 0.1)),
                                                         GREEN_DARKGREEN: (new Color(27, 41, 17), new Color(70, 84, 58), new Color(36, 60, 14), new Color(24, 50, 1), new Color(8, 10, 7), new Color(152, 255, 74), new Color(152, 255, 74, 0.1)),
                                                         BLUE2: (new Color(0, 68, 103), new Color(8, 109, 165), new Color(0, 72, 117), new Color(0, 72, 117), new Color(0, 68, 103), new Color(111, 182, 228), new Color(111, 182, 228, 0.1)),
                                                         BLUE_BLACK: (new Color(22, 125, 212), new Color(3, 162, 254), new Color(3, 162, 254), new Color(3, 162, 254), new Color(11, 172, 244), this.Colors.BLACK, new Color(0, 0, 0, 0.1)),
                                                         BLUE_DARKBLUE: (new Color(18, 33, 88), new Color(18, 33, 88), new Color(19, 30, 90), new Color(17, 31, 94), new Color(21, 25, 90), new Color(23, 99, 221), new Color(23, 99, 221, 0.1)),
                                                         BLUE_LIGHTBLUE: (new Color(88, 107, 132), new Color(53, 74, 104), new Color(27, 37, 65), new Color(5, 12, 40), new Color(32, 47, 79), new Color(71, 178, 254), new Color(71, 178, 254, 0.1)),
                                                         BLUE_GRAY: (new Color(135, 174, 255), new Color(101, 159, 255), new Color(44, 93, 255), new Color(27, 65, 254), new Color(12, 50, 255), new Color(178, 180, 237), new Color(178, 180, 237, 0.1)),
                                                         STANDARD: (new Color(131, 133, 119), new Color(176, 183, 167), new Color(165, 174, 153), new Color(166, 175, 156), new Color(175, 184, 165), new Color(35, 42, 52), new Color(35, 42, 52, 0.1)),
                                                         LIGHTGREEN: (new Color(194, 212, 188), new Color(212, 234, 206), new Color(205, 224, 194), new Color(206, 225, 194), new Color(214, 233, 206), new Color(0, 12, 6), new Color(0, 12, 6, 0.1)),
                                                         STANDARD_GREEN: (this.Colors.WHITE, new Color(219, 230, 220), new Color(179, 194, 178), new Color(153, 176, 151), new Color(114, 138, 109), new Color(0, 12, 6), new Color(0, 12, 6, 0.1)),
                                                         BLUE_BLUE: (new Color(100, 168, 253), new Color(100, 168, 253), new Color(95, 160, 250), new Color(80, 144, 252), new Color(74, 134, 255), new Color(0, 44, 187), new Color(0, 44, 187, 0.1)),
                                                         RED_DARKRED: (new Color(72, 36, 50), new Color(185, 111, 110), new Color(148, 66, 72), new Color(83, 19, 20), new Color(7, 6, 14), new Color(254, 139, 146), new Color(254, 139, 146, 0.1)),
                                                         DARKBLUE: (new Color(14, 24, 31), new Color(46, 105, 144), new Color(19, 64, 96), new Color(6, 20, 29), new Color(8, 9, 10), new Color(61, 179, 255), new Color(61, 179, 255, 0.1)),
                                                         PURPLE:(new Color(175, 164, 255), new Color(188, 168, 253), new Color(176, 159, 255), new Color(174, 147, 252), new Color(168, 136, 233), new Color(7, 97, 72), new Color(7, 97, 72, 0.1)),
                                                         BLACK_RED: (new Color(8, 12, 11), new Color(10, 11, 13), new Color(11, 10, 15), new Color(7, 13, 9), new Color(9, 13, 14), new Color(181, 0, 38), new Color(181, 0, 38, 0.1)),
                                                         DARKGREEN:(new Color(25, 85, 0), new Color(47, 154, 0), new Color(30, 101, 0), new Color(30, 101, 0), new Color(25, 85, 0), new Color(35, 49, 35), new Color(35, 49, 35, 0.1)),
                                                         AMBER: (new Color(182, 71, 0), new Color(236, 155, 25), new Color(212, 93, 5), new Color(212, 93, 5), new Color(182, 71, 0), new Color(89, 58, 10), new Color(89, 58, 10, 0.1)),
                                                         LIGHTBLUE: (new Color(125, 146, 184), new Color(197, 212, 231), new Color(138, 155, 194), new Color(138, 155, 194), new Color(125, 146, 184), new Color(9, 0, 81), new Color(9, 0, 81, 0.1)),
                                                         GREEN_BLACK: (new Color(1, 47, 0), new Color(20, 106, 61), new Color(33, 125, 84), new Color(33, 125, 84), new Color(33, 109, 63), new Color(3, 15, 11), new Color(3, 15, 11, 0.1)),
                                                         YELLOW_BLACK: (new Color(223, 248, 86), new Color(222, 255, 28), new Color(213, 245, 24), new Color(213, 245, 24), new Color(224, 248, 88), new Color(9, 19, 0), new Color(9, 19, 0, 0.1)),
                                                         BLACK_YELLOW: (new Color(43, 3, 3), new Color(29, 0, 0), new Color(26, 2, 2), new Color(31, 5, 8), new Color(30, 1, 3), new Color(255, 254, 24), new Color(255, 254, 24, 0.1)),
                                                         LIGHTGREEN_BLACK: (new Color(79, 121, 19), new Color(96, 169, 0), new Color(120, 201, 2), new Color(118, 201, 0), new Color(105, 179, 4), new Color(0, 35, 0), new Color(0, 35, 0, 0.1)),
                                                         DARKPURPLE: (new Color(35, 24, 75), new Color(42, 20, 111), new Color(40, 22, 103), new Color(40, 22, 103), new Color(41, 21, 111), new Color(158, 167, 210), new Color(158, 167, 210, 0.1)),
                                                         DARKAMBER: (new Color(134, 39, 17), new Color(120, 24, 0), new Color(83, 15, 12), new Color(83, 15, 12), new Color(120, 24, 0), new Color(233, 140, 44), new Color(233, 140, 44, 0.1)),
                                                         BLUE_LIGHTBLUE2: (new Color(15, 84, 151), new Color(60, 103, 198), new Color(67, 109, 209), new Color(67, 109, 209), new Color(64, 101, 190), new Color(193, 253, 254), new Color(193, 253, 254, 0.1)),
                                                         GRAY_PURPLE: (new Color(153, 164, 161), new Color(203, 215, 213), new Color(202, 212, 211), new Color(202, 212, 211), new Color(198, 209, 213), new Color(99, 124, 204), new Color(99, 124, 204, 0.1)),
                                                         FLAT_CUSTOM: (this.Colors.TRANSPARENT, this.Colors.TRANSPARENT, this.Colors.TRANSPARENT, this.Colors.TRANSPARENT, this.Colors.TRANSPARENT, this.Colors.WHITE, this.Colors.TRANSPARENT)
                                                       });
var LcdFonts             = Object.freeze({
                                                         STANDARD    : 'standard',
                                                         LCD         : 'lcd' ,
                                                         DIGITAL     : 'digital',
                                                         DIGITAL_BOLD: 'digitalBold',
                                                         ELEKTRA     : 'elektra'
                                                       });
var EventType            = Object.freeze({
                                           RECALC       : 'recalc',
                                           REDRAW       : 'redraw',
                                           RESIZE       : 'resize',
                                           LED          : 'led',
                                           LCD          : 'lcd',
                                           VISIBILITY   : 'visibility',
                                           INTERACTIVITY: 'interactivity',
                                           FINISHED     : 'finished',
                                           SECTION      : 'section'
                                         });


// ******************** Model *************************************************
class GaugeModel {
  constructor(parameters) {
    this.RECALC_EVENT                      = new UpdateEvent(this, EventType.RECALC);
    this.REDRAW_EVENT                      = new UpdateEvent(this, EventType.REDRAW);
    this.RESIZE_EVENT                      = new UpdateEvent(this, EventType.RESIZE);
    this.LED_EVENT                         = new UpdateEvent(this, EventType.LED);
    this.LCD_EVENT                         = new UpdateEvent(this, EventType.LCD);
    this.VISIBILITY_EVENT                  = new UpdateEvent(this, EventType.VISIBILITY);
    this.INTERACTIVITY_EVENT               = new UpdateEvent(this, EventType.INTERACTIVITY);
    this.FINISHED_EVENT                    = new UpdateEvent(this, EventType.FINISHED);
    this.SECTION_EVENT                     = new UpdateEvent(this, EventType.SECTION);

    this._param                            = parameters || {};
    this._minValue                         = this._param.minValue || 0;
    this._maxValue                         = this._param.maxValue || 100;
    this._value                            = this._param.value || this._minValue;
    this._oldValue                         = this._value;
    this._currentValue                     = this._value;
    this._formerValue                      = this._value;
    this._threshold                        = this._param.threshold || this._maxValue;
    this._range                            = this._maxValue - this._minValue;
    this._title                            = this._param.title || '';
    this._subTitle                         = this._param.subTitle || '';
    this._unit                             = this._param.unit || '';
    this._sections                         = this._param.sections || [ ];
    this._areas                            = this._param.areas || [ ];
    this._tickMarkSections                 = this._param.tickMarkSections || [ ];
    this._tickLabelSections                = this._param.tickLabelSections || [ ];
    this._markers                          = this._param.markers || [ ];
    this._startFromZero                    = this._param.startFromZero || false;
    this._returnToZero                     = this._param.returnToZero || false;
    this._zeroColor                        = this._param.zeroColor || Colors.DARK_COLOR;
    this._minMeasuredValue                 = this._param.minMeasuredValue || this._maxValue;
    this._maxMeasuredValue                 = this._param.maxMeasuredValue || this._minValue;
    this._minMeasuredValueVisible          = this._param.minMeasuredValueVisible || false;
    this._maxMeasuredValueVisible          = this._param.maxMeasuredValueVisible || false;
    this._oldValueVisible                  = this._param.oldValueVisible || false;
    this._valueVisible                     = this._param.valueVisible || true;
    this._backgroundPaint                  = this._param.backgroundPaint || Colors.TRANSPARENT;
    this._borderPaint                      = this._param.borderPaint || Colors.TRANSPARENT;
    this._borderWidth                      = this._param.borderWidth || 1;
    this._foregroundPaint                  = this._param.foregroundPaint || Colors.TRANSPARENT;
    this._knobColor                        = this._param.knobColor || new Color(204, 204, 204);
    this._knobType                         = this._param.knobType || KnobType.STANDARD;
    this._knobPosition                     = this._param.knobPosition || Pos.CENTER;
    this._knobVisible                      = this._param.knobVisible || true;
    this._animated                         = this._param.animated || false;
    this._animationDuration                = this._param.animationDuration || 800;
    this._startAngle                       = this._param.startAngle || 320;
    this._angleRange                       = this._param.angleRange || 280;
    this._angleStep                        = this._angleRange / this._range;
    this._autoScale                        = this._param.autoScale || true;
    this._shadowsEnabled                   = this._param.shadowsEnabled || false;
    this._barEffectEnabled                 = this._param.barEffectEnabled || false;
    this._scaleDirection                   = this._param.scaleDirection || ScaleDirection.CLOCKWISE;
    this._tickLabelLocation                = this._param.tickLabelLocation || TickLabelLocation.INSIDE;
    this._tickLabelOrientation             = this._param.tickLabelOrientation || Orientation.HORIZONTAL;
    this._tickLabelColor                   = this._param.tickLabelColor || Colors.DARK_COLOR;
    this._tickMarkColor                    = this._param.tickMarkColor || Colors.DARK_COLOR;
    this._majorTickMarkColor               = this._param.majorTickMarkColor || Colors.DARK_COLOR;
    this._majorTickMarkLengthFactor        = this._param.majorTickMarkLengthFactor || 0.42;
    this._majorTickMarkWidthFactor         = this._param.majorTickMarkWidthFactor || 0.275;
    this._mediumTickMarkColor              = this._param.mediumTickMarkColor || Colors.DARK_COLOR;
    this._mediumTickMarkLengthFactor       = this._param.mediumTickMarkLengthFactor || 0.41;
    this._mediumTickMarkWidthFactor        = this._param.mediumTickMarkWidthFactor || 0.175;
    this._minorTickMarkColor               = this._param.minorTickMarkColor || Colors.DARK_COLOR;
    this._minorTickMarkLengthFactor        = this._param.minorTickMarkLengthFactor || 0.40;
    this._minorTickMarkWidthFactor         = this._param.minorTickMarkWidthFactor || 0.1125;
    this._majorTickMarkType                = this._param.majorTickMarkType || TickMarkType.LINE;
    this._mediumTickMarkType               = this._param.mediumTickMarkType || TickMarkType.LINE;
    this._minorTickMarkType                = this._param.minorTickMarkType || TickMarkType.LINE;
    this._numberFormat                     = this._param.numberFormat || NumberFormat.AUTO;
    this._decimals                         = this._param.decimals || 1;
    this._tickLabelDecimals                = this._param.tickLabelDecimals || 0;
    this._needleType                       = this._param.needleType || NeedleType.STANDARD;
    this._needleShape                      = this._param.needleShape || NeedleShape.ANGLED;
    this._needleSize                       = this._param.needleSize || NeedleSize.STANDARD;
    this._needleBehavior                   = this._param.needleBehavior || NeedleBehavior.STANDARD;
    this._needleColor                      = this._param.needleColor || new Color(200, 0, 0);
    this._needleBorderColor                = this._param.needleBorderColor || Colors.TRANSPARENT;
    this._barColor                         = this._param.barColor  || Colors.BRIGHT_COLOR;
    this._barBorderColor                   = this._param.barBorderColor || Colors.TRANSPARENT;
    this._barBackgroundColor               = this._param.barBackgroundColor || Colors.DARK_COLOR;
    this._lcdDesign                        = this._param.lcdDesign || LcdDesigns.STANDARD;
    this._lcdFont                          = this._param.lcdFont || LcdFonts.DIGITALBOLD;
    this._ledColor                         = this._param.ledColor || Colors.RED;
    this._ledType                          = this._param.ledType || LedType.STANDARD;
    this._titleColor                       = this._param.titleColor || Colors.DARK_COLOR;
    this._subTitleColor                    = this._param.subTitleColor || Colors.DARK_COLOR;
    this._unitColor                        = this._param.unitColor || Colors.DARK_COLOR;
    this._valueColor                       = this._param.valueColor || Colors.DARK_COLOR;
    this._thresholdColor                   = this._param.thresholdColor || Colors.CRIMSON;
    this._checkSectionsForValue            = this._param.checkSectionsForValue || false;
    this._checkAreasForValue               = this._param.checkAreasForValue || false;
    this._checkThreshold                   = this._param.checkThreshold || false;
    this._innerShadowEnabled               = this._param.innerShadowEnabled || false;
    this._thresholdVisible                 = this._param.thresholdVisible || false;
    this._sectionsVisible                  = this._param.sectionsVisible || false;
    this._sectionTextVisible               = this._param.sectionTextVisible || false;
    this._sectionIconsVisible              = this._param.sectionIconsVisible || false;
    this._highlightSections                = this._param.highlightSections || false;
    this._areasVisible                     = this._param.areasVisible || false;
    this._areaTextVisible                  = this._param.areaTextVisible || false;
    this._areaIconsVisible                 = this._param.areaIconsVisible || false;
    this._highlightAreas                   = this._param.highlightAreas || false;
    this._tickMarkSectionsVisible          = this._param.tickMarkSectionsVisible || false;
    this._tickLabelSectionsVisible         = this._param.tickLabelSectionsVisible || false;
    this._markersVisible                   = this._param.markersVisible || false;
    this._tickLabelsVisible                = this._param.tickLabelsVisible || true;
    this._onlyFirstAndLastTickLabelVisible = this._param.onlyFirstAndLastTickLabelVisible || false;
    this._majorTickMarksVisible            = this._param.majorTickMarksVisible || true;
    this._mediumTickMarksVisible           = this._param.mediumTickMarksVisible || true;
    this._minorTickMarksVisible            = this._param.minorTickMarksVisible || true;
    this._tickMarkRingVisible              = this._param.tickMarkRingVisible || false;
    this._majorTickSpace                   = this._param.majorTickSpace || 10;
    this._minorTickSpace                   = this._param.minorTickSpace || 1;
    this._lcdVisible                       = this._param.lcdVisible || false;
    this._lcdCrystalEnabled                = this._param.lcdCrystalEnabled || false;
    this._ledVisible                       = this._param.ledVisible || false;
    this._ledOn                            = this._param.ledOn || false;
    this._ledBlinking                      = this._param.ledBlinking || false;
    this._orientation                      = this._param.orientation || Orientation.HORIZONTAL;
    this._gradientBarEnabled               = this._param.gradientBarEnabled || false;
    this._gradientLookup                   = this._param.gradientLookup || undefined;
    this._customTickLabelsEnabled          = this._param.customTickLabelsEnabled || false;
    this._customTickLabels                 = this._param.customTickLabels || [ ];
    this._customTickLabelFontSize          = this._param.customTickLabelFontSize || 18;
    this._interactive                      = this._param.interactive || false;
    this._buttonTooltipText                = this._param.buttonTooltipText || '';
    this._keepAspect                       = this._param.keepAspect || true;

    this.originalMinValue                  = -Number.MAX_VALUE;
    this.originalMaxValue                  = Number.MAX_VALUE;
    this.originalThreshold                 = Number.MAX_VALUE;

    var eventListenerList                  = [];


    // ******************** EventHandling *************************************
    this.setOnUpdateEvent = function(callback) { eventListenerList.push(callback); };
    this.removeOnUpdateEvent = function(callback) {
      var i = eventListenerList.indexOf(callback);
      if (i > -1) { eventListenerList.splice(i, 1); }
    };
    this.fireUpdateEvent = function(event) {
      var length = eventListenerList.length;
      for (var i = 0; i < length; i++) { eventListenerList[i](event); }
    };
  }


  // ******************** Methods *********************************************
  get value () { return this._value; }
  set value (value) {
    this._oldValue = this._value;
    this._value    = value;

    if (this._animated) {
      var targetValue = this._value < this._minValue ? this._minValue : (this._value > this._maxValue ? this._maxValue : this._value);
      var gaugeModel  = this;
      var tweenable   = new Tweenable();
      tweenable.tween({
                        from: { x: gaugeModel.oldValue },
                        to:   { x: targetValue },
                        duration: gaugeModel.animationDuration,
                        easing: 'easeInOutQuad',
                        step: function (state) {
                          gaugeModel._currentValue = state.x;
                          gaugeModel.fireUpdateEvent(gaugeModel.REDRAW_EVENT);
                        }
                      });
    } else {
      this._currentValue = value;
      if (this._value !== this._oldValue) { this.fireUpdateEvent(this.REDRAW_EVENT); }
    }
    this.fireUpdateEvent(this.FINISHED_EVENT);
  }

  get currentValue () { return this._currentValue; }

  get oldValue () { return this._oldValue; }

  get formerValue () { return this._formerValue; }
  
  get minValue () { return this._minValue; }
  set minValue (minValue) {
    this._minValue = minValue;
    this._range    = this._maxValue - this._minValue;
    this.fireUpdateEvent(this.RECALC_EVENT);

    if (minValue > this._maxValue) { this.maxValue = minValue; }
    this._minValue = clamp(-Number.MAX_VALUE, this.maxValue, minValue);
    this._range = this.maxValue - this._minValue;
    if (this.originalMinValue === -Number.MAX_VALUE) this.originalMinValue = this._minValue;
    if (this.startFromZero && this._minValue < 0) this.value  = 0;
    if (this.originalThreshold < this._threshold) { this.threshold = clamp(this._minValue, this.maxValue, this.originalThreshold); }

    this._value = clamp(this._minValue, this._maxValue, this._value);
  }

  get maxValue () { return this._maxValue; };
  set maxValue (maxValue) {
    this._maxValue = maxValue;
    this._range = this._maxValue - this._minValue;
    this.fireUpdateEvent(this.RECALC_EVENT);

    this._value = clamp(this._minValue, this._maxValue, this._value);
  };

  get threshold () { return this._threshold; }
  set threshold (threshold) {
      this._threshold = clamp(this._minValue, this._maxValue, this._threshold);
      this.fireUpdateEvent(this.RESIZE_EVENT);
  }

  get title () { return this._title; }
  set title (title) {
      this._title = title;
      this.fireUpdateEvent(this.VISIBILITY_EVENT);
  }

  get subTitle () { return this._subTitle; }
  set subTitle (subTitle) {
      this._subTitle = subTitle;
      this.fireUpdateEvent(this.VISIBILITY_EVENT);
  }

  get unit () { return this._unit; }
  set unit (unit) {
    this._unit = unit;
    this.fireUpdateEvent(this.VISIBILITY_EVENT);
  }

  get sections () { return this._sections; }
  set sections(sections) {
    this._sections = sections;
    this.fireUpdateEvent(this.SECTION_EVENT);
  }
  addSection(section) {
    if (undefined == section) return;
    this._sections.push(section);
    this.fireUpdateEvent(this.SECTION_EVENT);
  }
  removeSection(section) {
    if (undefined == section) return;
    var index = -1;
    for (var i = 0 ; i < this._sections.length ; i++) {
      if (this._sections[i] === section) { index = i; break; }
    }
    if (index > -1) {
      this._sections.splice(index, 1);
    }
    this.fireUpdateEvent(this.SECTION_EVENT);
  }
  clearSections() {
    while(this._sections.length > 0) { this._sections.pop(); }
    this.fireUpdateEvent(this.SECTION_EVENT);
  }

  get areas () { return this._areas; }
  set areas (areas) {
    this._areas = areas;
    this.fireUpdateEvent(this.SECTION_EVENT);
  }
  addArea(area) {
    if (undefined == area) return;
    this._areas.push(area);
    this.fireUpdateEvent(this.SECTION_EVENT);
  }
  removeArea(area) {
    if (undefined == area) return;
    var index = -1;
    for (var i = 0 ; i < this._areas.length ; i++) {
      if (this._areas[i] === area) { index = i; break; }
    }
    if (index > -1) {
      this._areas.splice(index, 1);
    }
    this.fireUpdateEvent(this.SECTION_EVENT);
  }
  clearAreas() {
    while(this._areas.length > 0) { this._areas.pop(); }
    this.fireUpdateEvent(this.SECTION_EVENT);
  }

  get tickMarkSections () { return this._tickMarkSections; }
  set tickMarkSections(sections) {
    this._tickMarkSections = sections;
    this.fireUpdateEvent(this.SECTION_EVENT);
  }
  addTickMarkSection(section) {
    if (undefined == section) return;
    this._tickMarkSections.push(section);
    this.fireUpdateEvent(this.SECTION_EVENT);
  }
  removeTickMarkSection(section) {
    if (undefined == section) return;
    var index = -1;
    for (var i = 0 ; i < this._tickMarkSections.length ; i++) {
      if (this._tickMarkSections[i] === section) { index = i; break; }
    }
    if (index > -1) {
      this._tickMarkSections.splice(index, 1);
    }
    this.fireUpdateEvent(this.SECTION_EVENT);
  }
  clearTickMarkSections() {
    while(this._tickMarkSections.length > 0) { this._tickMarkSections.pop(); }
    this.fireUpdateEvent(this.SECTION_EVENT);
  }

  get tickLabelSections () { return this._tickLabelSections; }
  set tickLabelSections(sections) {
    this._tickLabelSections = sections;
    this.fireUpdateEvent(this.SECTION_EVENT);
  }
  addTickLabelSection(section) {
    if (undefined == section) return;
    this._tickLabelSections.push(section);
    this.fireUpdateEvent(this.SECTION_EVENT);
  }
  removeTickLabelSection(section) {
    if (undefined == section) return;
    var index = -1;
    for (var i = 0 ; i < this._tickLabelSections.length ; i++) {
      if (this._tickLabelSections[i] === section) { index = i; break; }
    }
    if (index > -1) {
      this._tickLabelSections.splice(index, 1);
    }
    this.fireUpdateEvent(this.SECTION_EVENT);
  }
  clearTickLabelSections() {
    while(this._tickLabelSections.length > 0) { this._tickLabelSections.pop(); }
    this.fireUpdateEvent(this.SECTION_EVENT);
  }

  get markers () { return this._markers; }
  set markers (markers) {
    this._markers = markers;
    this.fireUpdateEvent(this.SECTION_EVENT);
  }
  addMarker(marker) {
    if (undefined == marker) return;
    this._markers.push(marker);
    this.fireUpdateEvent(this.SECTION_EVENT);
  }
  removeMarker(marker) {
    if (undefined == marker) return;
    var index = -1;
    for (var i = 0 ; i < this._markers.length ; i++) {
      if (this._markers[i] === marker) { index = i; break; }
    }
    if (index > -1) {
      this._markers.splice(index, 1);
    }
    this.fireUpdateEvent(this.SECTION_EVENT);
  }
  clearMarker() {
    while(this._markes.length > 0) { this._markers.pop(); }
    this.fireUpdateEvent(this.SECTION_EVENT);
  }

  // ******************** UI related methods ********************************
  set foregroundBaseColor (color) {
    this._titleColor          = color;
    this._subTitleColor       = color;
    this._unitColor           = color;
    this._valueColor          = color;
    this._tickLabelColor      = color;
    this._zeroColor           = color;
    this._tickMarkColor       = color;
    this._majorTickMarkColor  = color;
    this._mediumTickMarkColor = color;
    this._minorTickMarkColor  = color;
    this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get startFromZero () { return this._startFromZero; }
  set startFromZero (isTrue) {
      this._startFromZero = isTrue;
      this._value(isTrue && this._minValue < 0 ? 0 : this._minValue);
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get returnToZero () { return this._returnToZero; }
  set returnToZero (isTrue) {
      this._returnToZero = this._minValue <= 0 ? istrue : false;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get zeroColor () { return this._zeroColor; }
  set zeroColor (color) {
      this._zeroColor = color;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get minMeasuredValue () { return this._minMeasuredValue; }
  set minMeasuredValue (minMeasuredValue) { this._minMeasuredValue = minMeasuredValue; }

  get maxMeasuredValue () { return this._maxMeasuredValue; }
  set maxMeasuredValue (maxMeasuredValue) { this._maxMeasuredValue = maxMeasuredValue; }

  resetMeasuredValues() {
    this._minMeasuredValue = this._value;
    this._maxMeasuredValue = this._value;
  }

  get minMeasuredValueVisible () { return this._minMeasuredValueVisible; }
  set minMeasuredValueVisible (visible) {
      this._minMeasuredValueVisible = visible;
      this.fireUpdateEvent(this.VISIBILITY_EVENT);
  }

  get maxMeasuredValueVisible () { return this._maxMeasuredValueVisible; }
  set maxMeasuredValueVisible (visible) {
      this._maxMeasuredValueVisible = visible;
      this.fireUpdateEvent(this.VISIBILITY_EVENT);
  }

  get oldValueVisible () { return this._oldValueVisible; }
  set oldValueVisible (visible) {
      this._oldValueVisible = visible;
      this.fireUpdateEvent(this.VISIBILITY_EVENT);
  }

  get valueVisible () { return this._valueVisible; }
  set valueVisible (visible) {
      this._valueVisible = visible;
      this.fireUpdateEvent(this.VISIBILITY_EVENT);
  }

  get backgroundPaint () { return this._backgroundPaint; }
  set backgroundPaint (paint) {
      this._backgroundPaint = paint;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get borderPaint () { return this._borderPaint; }
  set borderPaint (paint) {
      this._borderPaint = paint;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get borderWidth () { return this._borderWidth; }
  set borderWidth (width) {
      this._borderWidth = clamp(0, 50, width);
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }
  
  get foregroundPaint () { return this._foregroundPaint; }
  set foregroundPaint (paint) {
      this._foregroundPaint = paint;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get knobColor () { return this._knobColor; }
  set knobColor (color) {
      this._knobColor = color;
      this.fireUpdateEvent(this.RESIZE_EVENT);
  }
  
  get knobType () { return this._knobType; }   set knobType (type) {
      this._knobType = undefined == type ? KnobType.STANDARD : type;
      this.fireUpdateEvent(this.RESIZE_EVENT);
  }
  get knobPosition () { return this._knobPosition; }
  set knobPosition (position) {
      this._knobPosition = position;
      this.fireUpdateEvent(this.RESIZE_EVENT);
  }
  
  get knobVisible () { return this._knobVisible; }
  set knobVisible (visible) {
      this._knobVisible = visible;
      this.fireUpdateEvent(this.VISIBILITY_EVENT);
  }

  get animated () { return this._animated; }
  set animated (animated) { this._animated = animated; }

  get animationDuration () { return this._animationDuration; }
  set animationDuration (animationDuration) { this._animationDuration = clamp(10, 10000, animationDuration); }

  get range () { return this._range; }
  set range (range) {
    this._range = range;
    this._angleStep = this._angleRange / this._range;
  }

  get startAngle () { return this._startAngle; }
  set startAngle (angle) {
      this._startAngle = clamp(0, 360, angle);
      this.fireUpdateEvent(this.RECALC_EVENT);
  }
  
  get angleRange () { return this._angleRange; }
  set angleRange (range) {
    this._angleRange = clamp(0, 360, range);
    this._angleStep  = this._angleRange / this._range;
    this.fireUpdateEvent(this.RECALC_EVENT);
  }

  get angleStep () { return this._angleStep; }
  set angleStep (step) { this._angleStep = step; }

  get autoScale () { return this._autoScale; }
  set autoScale (auto_scale) {
      this._autoScale = AUTO_SCALE;
      if (this._autoScale) {
        calcAutoScale();
      } else {
        this._minValue = this._originalMinValue;
        this._maxValue = this._originalMaxValue;
      }
      this.fireUpdateEvent(this.RECALC_EVENT);
  }
  
  get shadowsEnabled () { return this._shadowsEnabled; }
  set shadowsEnabled (enabled) {
      this._shadowsEnabled = enabled;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get barEffectEnabled () { return this._barEffectEnabled; }
  set barEffectEnabled (enabled) { this._barEffectEnabled = enabled; }

  get scaleDirection () { return this._scaleDirection; }
  set scaleDirection (direction) {
      this._scaleDirection = undefined == direction ? ScaleDirection.CLOCKWISE : direction;
      this.fireUpdateEvent(this.RECALC_EVENT);
  }

  get tickLabelLocation () { return this._tickLabelLocation; }
  set tickLabelLocation (location) {
      this._tickLabelLocation = undefined == location ? TickLabelLocation.INSIDE : location;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get tickLabelOrientation () { return this._tickLabelOrientation; }
  set tickLabelOrientation (orientation) {
      this._tickLabelOrientation = undefined == orientation ? TickLabelOrientation.HORIZONTAL : orientation;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get tickLabelColor () { return this._tickLabelColor; }
  set tickLabelColor (color) {
      this._tickLabelColor = color;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get tickMarkColor () { return this._tickMarkColor; }
  set tickMarkColor (color) {
      this._tickMarkColor = color;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get majorTickMarkColor () { return this._majorTickMarkColor; }
  set majorTickMarkColor (color) {
      this._majorTickMarkColor = color;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get majorTickMarkLengthFactor () { return this._majorTickMarkLengthFactor; }
  set majorTickMarkLengthFactor (factor) {
      this._majorTickMarkLengthFactor = Helper.clamp(0, 1, factor);
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }
  
  get majorTickMarkWidthFactor () { return this._majorTickMarkWidthFactor; }
  set majorTickMarkWidthFactor (factor) {
      this._majorTickMarkWidthFactor = clamp(0, 1, factor);
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }
  
  get mediumTickMarkColor () { return this._mediumTickMarkColor; }
  set mediumTickMarkColor (color) {
      this._mediumTickMarkColor = color;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get mediumTickMarkLengthFactor () { return this._mediumTickMarkLengthFactor; }
  set mediumTickMarkLengthFactor (factor) {
      this._mediumTickMarkLengthFactor = clamp(0, 1, factor);
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }
  
  get mediumTickMarkWidthFactor () { return this._mediumTickMarkWidthFactor; }
  set mediumTickMarkWidthFactor (factor) {
      this._mediumTickMarkWidthFactor = Helper.clamp(0, 1, factor);
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }
  
  get minorTickMarkColor () { return this._minorTickMarkColor; }
  set minorTickMarkColor (color) {
      this._minorTickMarkColor = color;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get minorTickMarkLengthFactor () { return this._minorTickMarkLengthFactor; }
  set minorTickMarkLengthFactor (factor) {
      this._minorTickMarkLengthFactor = Helper.clamp(0, 1, factor);
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }
  
  get minorTickMarkWidthFactor () { return this._minorTickMarkWidthFactor; }
  set minorTickMarkWidthFactor (factor) {
      this._minorTickMarkWidthFactor = Helper.clamp(0, 1, factor);
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }
  
  get majorTickMarkType () { return this._majorTickMarkType; }
  set majorTickMarkType (type) {
      this._majorTickMarkType = undefined == type ? TickMarkType.LINE : type;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get mediumTickMarkType () { return this._mediumTickMarkType; }
  set mediumTickMarkType (type) {
      this._mediumTickMarkType = undefined == type ? TickMarkType.LINE : type;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get minorTickMarkType () { return this._minorTickMarkType; }
  set minorTickMarkType (type) {
      this._minorTickMarkType = undefined == type ? TickMarkType.LINE : type;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get decimals () { return this._decimals; }
  set decimals (decimals) {
      this._decimals = clamp(0, 6, decimals);
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }
  
  get tickLabelDecimals () { return this._tickLabelDecimals; }
  set tickLabelDecimals (decimals) {
      this._tickLabelDecimals = clamp(0, 6, decimals);
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }
  
  get needleType () { return this._needleType; }
  set needleType (type) {
      this._needleType = undefined == type ? NeedleType.STANDARD : type;
      this.fireUpdateEvent(this.RESIZE_EVENT);
  }

  get needleShape () { return this._needleShape; }
  set needleShape (shape) {
      this._needleShape = undefined == shape ? NeedleShape.ANGLED : shape;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get needleSize () { return this._needleSize; }
  set needleSize (size) {
      this._needleSize = undefined == size ? NeedleSize.STANDARD : size;
      this.fireUpdateEvent(this.RESIZE_EVENT);
  }

  get needleBehavior () { return this._needleBehavior; }
  set needleBehavior (behavior) {
      this._needleBehavior = undefined == behavior ? NeedleBehavior.STANDARD : behavior;
  }

  get needleColor () { return this._needleColor; }
  set needleColor (color) {
      this._needleColor = color;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get needleBorderColor () { return this._needleBorderColor; }
  set needleBorderColor (color) {
      this._needleBorderColor = undefined == color ? Colors.TRANSPARENT : color;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get barColor () { return this._barColor; }
  set barColor (color) {
      this._barColor = color;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get barBorderColor () { return this._barBorderColor; }
  set barBorderColor (color) {
      this._barBorderColor = undefined == color ? Colors.TRANSPARENT : color;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get barBackgroundColor () { return this._barBackgroundColor; }
  set barBackgroundColor (color) {
      this._barBackgroundColor = color;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get lcdDesign () { return this._lcdDesign; }
  set lcdDesign (design) {
      this._lcdDesign = undefined == design ? LcdDesigns.STANDARD : design;
      this.fireUpdateEvent(this.LCD_EVENT);
  }

  get lcdFont () { return this._lcdFont; }
  set lcdFont (font) {
      this._lcdFont = undefined == font ? LcdFont.DIGITAL_BOLD : font;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get ledColor () { return this._ledColor; }
  set ledColor (color) {
      this._ledColor = undefined == colors ? Colors.RED : color;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get ledType () { return this._ledType; }
  set ledType (type) {
      this._ledType = undefined == type ? LedType.STANDARD : type;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get titleColor () { return this._titleColor; }
  set titleColor (color) {
      this._titleColor = color;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get subTitleColor () { return this._subTitleColor; }
  set subTitleColor (color) {
      this._subTitleColor = color;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get unitColor () { return this._unitColor; }
  set unitColor (color) {
      this._unitColor = color;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get valueColor () { return this._valueColor; }
  set valueColor (color) {
      this._valueColor = color;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get thresholdColor () { return this._thresholdColor; }
  set thresholdColor (color) {
      this._thresholdColor = color;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get checkSectionsForValue () { return this._checkSectionsForValue; }
  set checkSectionsForValue (check) { this._checkSectionsForValue = check; }

  get checkAreasForValue () { return this._checkAreasForValue; }
  set checkAreasForValue (check) { this._checkAreasForValue = check; }

  get checkThreshold () { return this._checkThreshold; }
  set checkThreshold (check) { this._checkThreshold = check; }

  get innerShadowEnabled () { return this._innerShadowEnabled; }
  set innerShadowEnabled (enabled) {
      this._innerShadowEnabled = enabled;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get thresholdVisible () { return this._thresholdVisible; }
  set thresholdVisible (visible) {
      this._thresholdVisible = visible;
      this.fireUpdateEvent(this.VISIBILITY_EVENT);
  }

  get sectionsVisible () { return this._sectionsVisible; }
  set sectionsVisible (visible) {
      this._sectionsVisible = visible;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get sectionsAlwaysVisible () { return this._sectionsAlwaysVisible; }
  set sectionsAlwaysVisible (visible) {
      this._sectionsAlwaysVisible = visible;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get sectionTextVisible () { return this._sectionTextVisible; }
  set sectionTextVisible (visible) {
      this._sectionTextVisible = visible;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get sectionIconsVisible () { return this._sectionIconsVisible; }
  set sectionIconsVisible (visible) {
      this._sectionIconsVisible = visible;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get highlightSections () { return this._highlightSections; }
  set highlightSections (highlight) {
      this._highlightSections = highlight;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get areasVisible () { return this._areasVisible; }
  set areasVisible (visible) {
      this._areasVisible = visible;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get areaTextVisible () { return this._areaTextVisible; }
  set areaTextVisible (visible) {
      this._areaTextVisible = visible;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get areaIconsVisible () { return this._areaIconsVisible; }
  set areaIconsVisible (visible) {
      this._areaIconsVisible = visible;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get highlightAreas () { return this._highlightAreas; }
  set highlightAreas (highlight) {
      this._highlightAreas = highlight;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get tickMarkSectionsVisible () { return this._tickMarkSectionsVisible; }
  set tickMarkSectionsVisible (visible) {
      this._tickMarkSectionsVisible = visible;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get tickLabelSectionsVisible () { return this._tickLabelSectionsVisible; }
  set tickLabelSectionsVisible (visible) {
      this._tickLabelSectionsVisible = visible;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get markersVisible () { return this._markersVisible; }
  set markersVisible (visible) {
      this._markersVisible = visible;
      this.fireUpdateEvent(this.VISIBILITY_EVENT);
  }

  get tickLabelsVisible () { return this._tickLabelsVisible; }
  set tickLabelsVisible (visible) {
      this._tickLabelsVisible = visible;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get onlyFirstAndLastTickLabelVisible () { this._onlyFirstAndLastTickLabelVisible; }
  set onlyFirstAndLastTickLabelVisible (visible) {
      this._onlyFirstAndLastTickLabelVisible = visible;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get majorTickMarksVisible () { return this._majorTickMarksVisible; }
  set majorTickMarksVisible (visible) {
      this._majorTickMarksVisible = visible;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get mediumTickMarksVisible () { return this._mediumTickMarksVisible; }
  set mediumTickMarksVisible (visible) {
      this._mediumTickMarksVisible = visible;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get minorTickMarksVisible () { return this._minorTickMarksVisible; }
  set minorTickMarksVisible (visible) {
      this._minorTickMarksVisible = visible;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }
  
  get tickMarkRingVisible () { return this._tickMarkRingVisible; }
  set tickMarkRingVisible (visible) {
      this._tickMarkRingVisible = visible;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get majorTickSpace () { return this._majorTickSpace; }
  set majorTickSpace (space) {
      this._majorTickSpace = space;
      this.fireUpdateEvent(this.RECALC_EVENT);
  }

  get minorTickSpace () { return this._minorTickSpace; }
  set minorTickSpace (space) {
      this._minorTickSpace = space;
      this.fireUpdateEvent(this.RECALC_EVENT);
  }

  get lcdVisible () { return this._lcdVisible; }
  set lcdVisible (visible) {
      this._lcdVisible = visible;
      this.fireUpdateEvent(this.VISIBILITY_EVENT);
  }

  get lcdCrystalEnabled () { return this._lcdCrystalEnabled; }
  set lcdCrystalEnabled (enabled) {
      this._lcdCrystalEnabled = enabled;
      this.fireUpdateEvent(this.VISIBILITY_EVENT);
  }

  get ledVisible () { return this._ledVisible; }
  set ledVisible (visible) {
      this._ledVisible = visible;
      this.fireUpdateEvent(this.VISIBILITY_EVENT);
  }

  get ledOn () { return this._ledOn; }
  set ledOn (on) {
      this._ledOn = on;
      this.fireUpdateEvent(this.LED_EVENT);
  }

  get ledBlinking () { return this._ledBlinking; }
  set ledBlinking (blinking) {
      this._ledBlinking = blinking;
      if (this._ledBlinking) {
        startBlinkExecutorService();
      } else {
        if (null != blinkFuture) blinkFuture.cancel(true);
        setLedOn(false);
      }
  }

  get orientation () { return this._orientation; }
  set orientation (orientation) {
      this._orientation = orientation;
      this.fireUpdateEvent(this.RESIZE_EVENT);
  }

  get gradientBarEnabled () { return this._gradientBarEnabled; }
  set gradientBarEnabled (enabled) {
      this._gradientBarEnabled = enabled;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get gradientLookup () { return this._gradientLookup; }
  set gradientLookup (gradientLookup) { 
    this._gradientLookup = gradientLookup;
    this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get gradientBarStops () { return undefined === this._gradientLookup ? [] : this._gradientLookup.stops; }

  get customTickLabelsEnabled () { return this._customTickLabelsEnabled; }
  set customTickLabelsEnabled (enabled) {
      this._customTickLabelsEnabled = enabled;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get customTickLabels () { return this._customTickLabels; }
  set markers (customTickLabels) {
    this._customTickLabels = customTickLabels;
    this.fireUpdateEvent(this.REDRAW_EVENT);
  }
  addCustomTickLabel(customTickLabel) {
    if (undefined == customTickLabel) return;
    this._customTickLabels.push(customTickLabel);
    this.fireUpdateEvent(this.REDRAW_EVENT);
  }
  removeCustomTickLabel(customTickLabel) {
    if (undefined == customTickLabel) return;
    var index = -1;
    for (var i = 0 ; i < this._customTickLabels.length ; i++) {
      if (this._customTickLabels[i] === customTickLabel) { index = i; break; }
    }
    if (index > -1) {
      this._customTickLabels.splice(index, 1);
    }
    this.fireUpdateEvent(this.REDRAW_EVENT);
  }
  clearCustomTickLabels() {
    while(this._customTickLabels.length > 0) { this._customTickLabels.pop(); }
    this.fireUpdateEvent(this.SECTION_EVENT);
  }
  
  get customTickLabelFontSize () { return this._customTickLabelFontSize; }
  set customTickLabelFontSize (size) {
      this._customTickLabelFontSize = clamp(0, 72, size);
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get interactive () { return this._interactive; }
  set interactive (interactive) {
      this._interactive = interactive;
      this.fireUpdateEvent(this.INTERACTIVITY_EVENT);
  }

  get buttonTooltipText () { return this._buttonTooltipText; }
  set buttonTooltipText (text) {
      this._buttonTooltipText = text;
      this.fireUpdateEvent(this.REDRAW_EVENT);
  }

  get keepAspect () { return this._keepAspect; }
  set keepAspect (keep) { this._keepAspect = keep; }
}


// ******************** Skins *************************************************
class DashboardGauge {
  constructor(parameters) {
    this._model                    = new GaugeModel(parameters);
    this._doc                      = document;
    this._param                    = parameters || {};
    this._id                       = this._param.id || 'control';
    this._parentId                 = this._param.parentId || 'body';

    // PreSets for this Skin
    this._model.barBackgroundColor = new Color(211, 211, 211);
    this._model.barColor           = new Color(93, 190, 205);
    this._model.decimals           = 0;
    this._model.startAngle         = Math.PI;
    this._model.angleRange         = Math.PI;

    var self                       = this;
    var scalable                   = this._param.scalable === undefined ? false : this._param.scalable;
    var width                      = this._param.width || 200;
    var height                     = this._param.height || 148;
    var aspectRatio                = 0.74;
    var stopAngle                  = 0;
    var ROBOTO_THIN_FONT_NAME      = 'roboto-thin';
    var ROBOTO_REGULAR_FONT_NAME   = 'roboto-regular';
    var ROBOTO_BOLD_FONT_NAME      = 'roboto-bold';
    var tinyFont                   = Math.floor(0.07 * height) + 'px ' + ROBOTO_BOLD_FONT_NAME;
    var smallFont                  = Math.floor(0.12 * height) + 'px ' + ROBOTO_THIN_FONT_NAME;
    var bigFont                    = Math.floor(0.24 * height) + 'px ' + ROBOTO_REGULAR_FONT_NAME;
    var currentValueAngle          = 0;

    if (scalable) { window.addEventListener("resize", onResize, false); }

    // Create the <canvas> element
    var canvas    = this._doc.createElement('canvas');
    canvas.id     = this._id;
    canvas.width  = width;
    canvas.height = height;
    this._parentId === 'body' ? this._doc.body.appendChild(canvas) : this._doc.getElementById(this._parentId).appendChild(canvas);

    // Get the <canvas> context and create all buffers
    var mainCtx          = this._doc.getElementById(this._id).getContext('2d');
    var backgroundBuffer = this._doc.createElement('canvas');
    var foregroundBuffer = this._doc.createElement('canvas');


    function onResize() {
      if (scalable) {
        width  = window.innerWidth;
        height = window.innerHeight;
      }

      if (aspectRatio * width > height) {
        width = 1 / (aspectRatio / height);
      } else if (1 / (aspectRatio / height) > width) {
        height = aspectRatio * width;
      }
      tinyFont  = Math.floor(0.07 * height) + 'px ' + ROBOTO_BOLD_FONT_NAME;
      smallFont = Math.floor(0.12 * height) + 'px ' + ROBOTO_THIN_FONT_NAME;
      bigFont   = Math.floor(0.24 * height) + 'px ' + ROBOTO_REGULAR_FONT_NAME;

      canvas.width  = width;
      canvas.height = height;

      backgroundBuffer.width  = width;
      backgroundBuffer.height = height;
      foregroundBuffer.width  = width;
      foregroundBuffer.height = height;

      mainCtx.canvas.width  = canvas.width;
      mainCtx.canvas.height = canvas.height;

      drawBackground();
      updateBar();

      redraw();
    }

    function redraw() {
      mainCtx.clearRect(0, 0, canvas.width, canvas.height);
      mainCtx.drawImage(backgroundBuffer, 0, 0);
      mainCtx.drawImage(foregroundBuffer, 0, 0);
    }

    function drawBackground() {
      var ctx = backgroundBuffer.getContext('2d');
      ctx.clearRect(0, 0, width, height);

      // barBackground
      ctx.beginPath();
      ctx.arc(0.5 * width, 0.675 * height, 0.675 * height, self._model.startAngle, stopAngle, false);
      ctx.arc(0.5 * width, 0.675 * height, 0.3 * height, stopAngle, self._model.startAngle, true);
      ctx.closePath();

      ctx.fillStyle = self._model.barBackgroundColor.asRGB;
      ctx.fill();

      // innerShadow
      if (self._model.shadowsEnabled) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0.5 * width, 0.675 * height, 0.675 * height, self._model.startAngle, currentValueAngle, false);
        ctx.arc(0.5 * width, 0.675 * height, 0.3 * height, currentValueAngle, self._model.startAngle, true);
        ctx.closePath();
        ctx.clip();
        ctx.beginPath();
        ctx.strokeStyle   = self._model.barBackgroundColor.asRGB;
        ctx.lineWidth     = 2;
        ctx.shadowBlur    = 10;
        ctx.shadowColor   = 'rgba(0, 0, 0, 0.65)';
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 5;
        ctx.arc(0.5 * width, 0.675 * height, 0.675 * height, self._model.startAngle, currentValueAngle, false);
        ctx.arc(0.5 * width, 0.675 * height, 0.3 * height, currentValueAngle, self._model.startAngle, true);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      // unit
      ctx.font      = smallFont;
      ctx.textAlign = 'center';
      ctx.fillStyle = self._model.unitColor.asRGB;
      ctx.fillText(undefined == self._model.unit ? '' : self._model.unit, 0.5 * width, 0.62 * height);

      // title
      ctx.fillStyle = self._model.titleColor.asRGB;
      ctx.fillText(undefined == self._model.title ? '' : self._model.title, 0.5 * width, 0.99 * height);

      // minValue
      ctx.fillStyle = self._model.tickLabelColor.asRGB;
      ctx.fillText((parseFloat(self._model.minValue).toFixed(self._model.tickLabelDecimals)), width * 0.13, height * 0.82, 0.22222 * width);

      // maxValue
      ctx.fillStyle = self._model.tickLabelColor.asRGB;
      ctx.fillText((parseFloat(self._model.maxValue).toFixed(self._model.tickLabelDecimals)), width * 0.87, height * 0.82, 0.22222 * width);
    }

    function updateBar() {
      var ctx = foregroundBuffer.getContext('2d');
      ctx.clearRect(0, 0, width, height);

      // bar
      currentValueAngle = self._model.angleStep * (self._model.currentValue - self._model.minValue) + self._model.startAngle;
      currentValueAngle = clamp(Math.PI, 2 * Math.PI, currentValueAngle);
      ctx.beginPath();
      ctx.arc(0.5 * width, 0.675 * height, 0.675 * height, self._model.startAngle, currentValueAngle, false);
      ctx.arc(0.5 * width, 0.675 * height, 0.3 * height, currentValueAngle, self._model.startAngle, true);
      ctx.closePath();

      ctx.fillStyle = self._model.gradientBarEnabled ? self._model.gradientLookup.getColorAt(self._model.currentValue / self._model.range).asRGB : self._model.barColor.asRGB;
      ctx.fill();

      if (self._model.shadowsEnabled) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0.5 * width, 0.675 * height, 0.675 * height, self._model.startAngle, currentValueAngle, false);
        ctx.arc(0.5 * width, 0.675 * height, 0.3 * height, currentValueAngle, self._model.startAngle, true);
        ctx.closePath();
        ctx.clip();
        ctx.beginPath();
        ctx.strokeStyle   = self._model.gradientBarEnabled ? self._model.gradientLookup.getColorAt(self._model.value / self._model.range).asRGB : self._model.barColor.asRGB;
        ctx.lineWidth     = 2;
        ctx.shadowBlur    = 10;
        ctx.shadowColor   = 'rgba(0, 0, 0, 0.65)';
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 5;
        ctx.arc(0.5 * width, 0.675 * height, 0.675 * height, self._model.startAngle, currentValueAngle, false);
        ctx.arc(0.5 * width, 0.675 * height, 0.3 * height, currentValueAngle, self._model.startAngle, true);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      // value
      ctx.textAlign = 'center';
      ctx.fillStyle = self._model.valueColor.asRGB;
      ctx.font      = bigFont;
      ctx.fillText((parseFloat(self._model.currentValue).toFixed(self._model.decimals)), width * 0.5, height * 0.855);

      // Threshold
      if (self._model.thresholdVisible) {
        var centerX              = width * 0.5;
        var thresholdAngle       = clamp(Math.PI * 0.5, Math.PI * 1.5, (self._model.threshold - self._model.minValue) * self._model.angleStep + Math.PI * 0.5);
        var thresholdTextRadius  = 0.235 * height;
        var thresholdInnerRadius = 0.3 * height;
        var thresholdOuterRadius = 0.675 * height;
        var thresholdStartX      = centerX + thresholdInnerRadius * Math.sin(-thresholdAngle);
        var thresholdStartY      = centerX + thresholdInnerRadius * Math.cos(-thresholdAngle);
        var thresholdEndX        = centerX + thresholdOuterRadius * Math.sin(-thresholdAngle);
        var thresholdEndY        = centerX + thresholdOuterRadius * Math.cos(-thresholdAngle);

        // Threshold Text
        ctx.font = tinyFont;
        ctx.translate(centerX + thresholdTextRadius * Math.sin(-thresholdAngle), centerX + thresholdTextRadius * Math.cos(-thresholdAngle));
        ctx.rotate(thresholdAngle + Math.PI);
        ctx.fillText((parseFloat(self._model.threshold).toFixed(self._model.decimals)), 0, 0)
        ctx.rotate(-(thresholdAngle + Math.PI));
        ctx.translate(-(centerX + thresholdTextRadius * Math.sin(-thresholdAngle)), -(centerX + thresholdTextRadius * Math.cos(-thresholdAngle)));

        // Threshold Line
        ctx.beginPath();
        ctx.moveTo(thresholdStartX, thresholdStartY);
        ctx.lineTo(thresholdEndX, thresholdEndY);
        ctx.strokeStyle = self._model.thresholdColor.asRGB;
        ctx.stroke();
      }
    }

    // Register listener
    this._model.setOnUpdateEvent(function(event) {
      //console.log("source: " + event.source.currentValue);
      //console.log("event: " + event.type);
      switch(event.type) {
        case "redraw": drawBackground(); updateBar(); redraw(); break;
      }
    });

    onResize();
  }

  get model () { return this._model; }
  set model (model) { this.model = model; }
}

class SimpleGauge {
  constructor(parameters) {
    this._model                    = new GaugeModel(parameters);
    this._doc                      = document;
    this._param                    = parameters || {};
    this._id                       = this._param.id || 'control';
    this._parentId                 = this._param.parentId || 'body';

    // PreSets for this Skin
    this._model.decimals           = 0;
    this._model.startAngle         = Math.PI * 0.75;
    this._model.angleRange         = Math.PI * 1.5;
    this._model.knobPosition       = Pos.CENTER;
    this._model.borderPaint        = Colors.WHITE.asRGB;
    this._model.needleBorderColor  = Colors.WHITE.asRGB;
    this._model.backgroundPaint    = '#a9a9a9';
    this._model.tickLabelColor     = Colors.WHITE.asRGB;
    this._model.needleColor        = '#5a615f';
    this._model.valueColor         = Colors.WHITE.asRGB;
    this._model.titleColor         = Colors.WHITE.asRGB;
    this._model.subTitleColor      = Colors.WHITE.asRGB;

    var self                       = this;
    var scalable                   = this._param.scalable === undefined ? false : this._param.scalable;
    var width                      = this._param.width || 250;
    var height                     = this._param.height || 250;
    var size                       = width < height ? width : height;
    var stopAngle                  = 0;
    var ROBOTO_THIN_FONT_NAME      = 'roboto-thin';
    var ROBOTO_REGULAR_FONT_NAME   = 'roboto-regular';
    var ROBOTO_MEDIUM_FONT_NAME    = 'roboto-medium';
    var smallFont                  = Math.floor(0.045 * size) + 'px ' + ROBOTO_REGULAR_FONT_NAME;
    var bigFont                    = Math.floor(0.145 * size) + 'px ' + ROBOTO_REGULAR_FONT_NAME;
    var currentValueAngle          = 0;

    if (scalable) { window.addEventListener("resize", onResize, false); }

    // Create the <canvas> element
    var canvas    = this._doc.createElement('canvas');
    canvas.id     = this._id;
    canvas.width  = size;
    canvas.height = size;
    this._parentId === 'body' ? this._doc.body.appendChild(canvas) : this._doc.getElementById(this._parentId).appendChild(canvas);

    // Get the <canvas> context and create all buffers
    var mainCtx          = this._doc.getElementById(this._id).getContext('2d');
    var backgroundBuffer = this._doc.createElement('canvas');
    var foregroundBuffer = this._doc.createElement('canvas');


    function onResize() {
      if (scalable) {
        width  = window.innerWidth;
        height = window.innerHeight;
        size   = width < height ? width : height;
      }

      smallFont = Math.floor(0.12 * height) + 'px ' + ROBOTO_THIN_FONT_NAME;
      bigFont   = Math.floor(0.24 * height) + 'px ' + ROBOTO_REGULAR_FONT_NAME;

      canvas.width  = size;
      canvas.height = size;

      backgroundBuffer.width  = size;
      backgroundBuffer.height = size;
      foregroundBuffer.width  = size;
      foregroundBuffer.height = size;

      mainCtx.canvas.width  = canvas.width;
      mainCtx.canvas.height = canvas.height;

      drawBackground();
      drawForeground();

      redraw();
    }

    function redraw() {
      mainCtx.clearRect(0, 0, canvas.width, canvas.height);
      mainCtx.drawImage(backgroundBuffer, 0, 0);
      mainCtx.drawImage(foregroundBuffer, 0, 0);
    }

    function drawBackground() {
      var ctx = backgroundBuffer.getContext('2d');
      ctx.clearRect(0, 0, size, size);

      //sections
      ctx.save();
      ctx.translate(0.5 * size, 0.5 * size);
      ctx.rotate(self._model.startAngle);
      ctx.translate(-0.5 * size, -0.5 * size);
      var length = self._model.sections.length;
      if (null !== self._model.sections && 0 < length) {
        for (var i = 0; i < length; i++) {
          drawSection(ctx, size, self._model.sections[i].start, self._model.sections[i].stop, self._model.sections[i].color, true);
          if (self._model.sectionIconsVisible) drawSectionIcon(ctx, size, self._model.sections[i].start, self._model.sections[i].stop, self._model.sections[i].image);
        }
      }
      drawSection(ctx, size, self._model.minValue, self._model.maxValue, Colors.WHITE, false);
      ctx.restore();

      // SubTitle Text
      if (self._model.subTitle.length > 0) {
        ctx.textAlign = 'center';
        var fontSize  = Math.floor(0.075 * size);
        ctx.font  = Math.floor(fontSize) + 'px ' + ROBOTO_REGULAR_FONT_NAME;
        var metrics   = ctx.measureText(self._model.subTitle);
        var textWidth = metrics.width;
        if (textWidth > 0.45 * size) {
          var decrement = 0;
          while (textWidth > 0.45 * size && fontSize > 0) {
            fontSize  = size * (0.145 - decrement);
            ctx.font  = Math.floor(fontSize) + 'px ' + ROBOTO_REGULAR_FONT_NAME;
            metrics   = ctx.measureText(self._model.subTitle);
            textWidth = metrics.width;
            decrement += 0.01;
          }
        }
        ctx.fillText(self._model.subTitle, size * 0.5, size * 0.85);
      }

      if (self._model.tickLabelsVisible) {
        var fontSize  = Math.floor(0.1 * size);
        ctx.font      = Math.floor(fontSize) + 'px ' + ROBOTO_REGULAR_FONT_NAME;
        ctx.fillStyle = self._model.tickLabelColor;
        ctx.textAlign = 'left';
        ctx.fillText(parseFloat(self._model.minValue).toFixed(self._model.tickLabelDecimals), size * 0.15075377, size * 0.95, size * 0.3);
        ctx.textAlign = 'right';
        ctx.fillText(parseFloat(self._model.maxValue).toFixed(self._model.tickLabelDecimals), size * 0.84924623, size * 0.95, size * 0.3);
      }
    }

    var drawSection = function(ctx, size, start, stop, color, fill) {
      start = start < self._model.minValue ? self._model.minValue : start > self._model.maxValue ? self._model.maxValue : start;
      stop  = stop < self._model.minValue ? self._model.minValue : stop > self._model.maxValue ? self._model.maxValue : stop;
      var sectionStartAngle = ((self._model.angleStep * start - self._model.angleStep * self._model.minValue));
      var sectionStopAngle = sectionStartAngle + (stop - start) / (self._model.range / self._model.angleRange);

      ctx.translate(0.5 * size, 0.5 * size);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0.0, 0.0, 0.49 * size, sectionStartAngle, sectionStopAngle, false);
      if (fill) ctx.moveTo(0, 0);
      ctx.translate(-0.5 * size, -0.5 * size);
      ctx.closePath();
      if (fill) {
        ctx.fillStyle = color.asRGB;
        ctx.fill();
      } else {
        ctx.strokeStyle = color.asRGB;
        ctx.lineWidth   = 0.02 * size;
        ctx.stroke();
      }
    };

    var drawSectionIcon = function(ctx, size, start, stop, icon) {
      start = start < self._model.minValue ? self._model.minValue : start > self._model.maxValue ? self._model.maxValue : start;
      stop  = stop < self._model.minValue ? self._model.minValue : stop > self._model.maxValue ? self._model.maxValue : stop;

      var sectionStartAngle = self._model.startAngle + (start - self._model.minValue) * self._model.angleStep;
      var sectionStopAngle  = (stop - start) * self._model.angleStep;

      var sinValue  = Math.sin(self._model.startAngle + Math.radians(180 - sectionStartAngle - sectionStopAngle * 0.5 + 0.015 * size));
      var cosValue  = Math.cos(self._model.startAngle + Math.radians(180 - sectionStartAngle - sectionStopAngle * 0.5 + 0.015 * size));
      var iconPoint = new Array((size * 0.5 + size * 0.365 * sinValue), (size * 0.5 + size * 0.365 * cosValue));

      var img = new Image();
      img.src = icon;
      img.onload = function() {
        ctx.drawImage(img, iconPoint[0] - size * 0.06, iconPoint[1] - size * 0.06, size * 0.12, size * 0.12);
      }
    };

    function drawForeground() {
      var ctx = foregroundBuffer.getContext('2d');
      ctx.clearRect(0, 0, size, size);

      //needle
      ctx.save();
      ctx.translate(0.5 * size, 0.5 * size);
      ctx.rotate((((self._model.angleStep * (self._model.currentValue - self._model.minValue)) - Math.PI * 0.75)));
      ctx.translate(-0.5 * size, -0.5 * size);

      ctx.beginPath();
      ctx.moveTo(0.275 * size, 0.5 * size);
      ctx.bezierCurveTo(0.275 * size, 0.62426575 * size, 0.37573425 * size, 0.725 * size, 0.5 * size, 0.725 * size);
      ctx.bezierCurveTo(0.62426575 * size, 0.725 * size, 0.725 * size, 0.62426575 * size, 0.725 * size, 0.5 * size);
      ctx.bezierCurveTo(0.725 * size, 0.3891265 * size, 0.6448105 * size, 0.296985 * size, 0.5392625 * size, 0.2784125 * size);
      ctx.lineTo(0.5 * size, size * 0.012);
      ctx.lineTo(0.4607375 * size, 0.2784125 * size);
      ctx.bezierCurveTo(0.3551895 * size, 0.296985 * size, 0.275 * size, 0.3891265 * size, 0.275 * size, 0.5 * size);
      ctx.closePath();
      ctx.fillStyle = self._model.needleColor;
      ctx.fill();

      ctx.strokeStyle = 'white';
      ctx.lineJoin    = 'bevel';
      ctx.lineCap     = 'round';
      ctx.lineWidth   = (size * 0.03).toFixed(0);
      ctx.stroke();
      ctx.restore();

      // Value text
      ctx.textAlign      = 'center';
      ctx.fillStyle      = 'white';
      ctx.font           = bigFont;
      var valueFontSize  = Math.floor(0.25 * size);
      var valueText      = (parseFloat(self._model.currentValue).toFixed(self._model.decimals) + self._model.unit);
      var metrics        = ctx.measureText(valueText);
      var textWidth      = metrics.width;
      if (textWidth > 0.35 * size) {
        var decrement = 0;
        while (textWidth > 0.35 * size && valueFontSize > 0) {
          valueFontSize  = size * (0.145 - decrement);
          ctx.font       = Math.floor(valueFontSize) + 'px ' + ROBOTO_REGULAR_FONT_NAME;
          metrics        = ctx.measureText(valueText);
          textWidth      = metrics.width;
          decrement += 0.01;
        }
      }
      ctx.fillText(valueText, size * 0.5, self._model.title.length > 0 ? size * 0.54 : size * 0.58);

      // Title text
      if (self._model.title.length > 0) {
        var fontSize  = Math.floor(0.075 * size);
        ctx.font      = Math.floor(fontSize) + 'px ' + ROBOTO_REGULAR_FONT_NAME;
        metrics       = ctx.measureText(self._model.title);
        textWidth     = metrics.width;
        if (textWidth > 0.3 * size) {
          var decrement = 0;
          while (textWidth > 0.3 * size && titleFontSize > 0) {
            fontSize  = size * (0.145 - decrement);
            ctx.font       = Math.floor(fontSize) + 'px ' + ROBOTO_REGULAR_FONT_NAME;
            metrics        = ctx.measureText(self._model.title);
            textWidth      = metrics.width;
            decrement += 0.01;
          }
        }
        ctx.fillText(self._model.title, size * 0.5, self._model.unit.length > 0 ? size * 0.5 + valueFontSize : size * 0.5 + valueFontSize * 0.5);
      }
    }

    // Register listener
    this._model.setOnUpdateEvent(function(event) {
      //console.log("source: " + event.source.currentValue);
      //console.log("event: " + event.type);
      switch(event.type) {
        case "redraw": drawBackground(); drawForeground(); redraw(); break;
        case "resize": drawBackground(); drawForeground(); redraw(); break;
      }
    });

    onResize();
  }

  get model () { return this._model; }
  set model (model) { this.model = model; }
}

function clamp(min, max, value) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
