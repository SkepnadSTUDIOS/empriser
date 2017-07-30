precision mediump float;

varying vec2 vTextureCoord;
varying vec4 vColor;

uniform sampler2D uSampler;
uniform float view_scale;
uniform vec2 view_dims;
uniform vec2 view_position;
uniform vec2 map_dims;

uniform vec4 filterArea;

#pragma glslify: import('./coords/img2hex.glsl')
#pragma glslify: import('./coords/tex2img.glsl')
#pragma glslify: import('./coords/hex2dat.glsl')
#pragma glslify: import('./color/hsv2rgb.glsl')
#pragma glslify: import('./color/terrain_zones.glsl')
#pragma glslify: import('./noise.glsl')

const vec3 climate0 = vec3(240.0/255.0,220.0/255.0,192.0/255.0);
const vec3 climate1 = vec3(148.0/255.0,137.0/255.0,105.0/255.0);
const vec3 climate2 = vec3(058.0/255.0,107.0/255.0,045.0/255.0);
const vec3 climate3 = vec3(054.0/255.0,096.0/255.0,042.0/255.0);
const vec3 climate4 = vec3(053.0/255.0,082.0/255.0,040.0/255.0);
const vec3 climate5 = vec3(122.0/255.0,115.0/255.0,087.0/255.0);
const vec3 climate6 = vec3(252.0/255.0,252.0/255.0,255.0/255.0);

const vec3 elevation = vec3(120.0/255.0,120.0/255.0,087.0/255.0);

float fbm(vec2 p,float c,float H){
  float sum = 0.0;
  for(int i=0;i<5;i++){
    sum += c * cnoise(p);
    c *= H;
    p *= 2.0;
  }

  return sum;
}

float elnoise(vec2 wld,int zone){
  if(zone == 0) return fbm(3.0 * wld,0.4,0.75);
  if(zone == 1) return fbm(0.3 * wld,0.1,0.4); //fbm(1.0 * wld,0.3,0.35);
  else if(zone == 2) return fbm(0.4 * wld,0.1,0.4);
  else if(zone == 3) return fbm(0.2 * wld,0.3,0.75);
}

float edgeify(float edge,float x,float amt){
  if(edge < amt){
    return x*edge/amt +(1.0-edge/amt);
  }else return x;
}

float elshade(float edge,vec2 wld,int zone){
  vec2 dir;
  // find derivatives
  dir.x = elnoise(wld,zone) - elnoise(wld+0.001,zone);
  dir.y = elnoise(-wld,zone) - elnoise(-wld-0.001,zone);

  // calculate dot product to find shading vs. generic light source
  float el = dot(vec2(1.0,0.0),dir) / length(dir);
  float atten;
  if(zone > 0) atten = 0.1*(4.0-float(zone)) + 0.65;
  else atten = 0.9;
  return atten + el*(1.0-atten);
}

float patchy(vec2 wld){
  float result = 0.75;
  result += 0.12*step(-0.5,fbm(wld,1.0,0.6));
  result += 0.12*step(-0.5,fbm(-wld,1.0,0.6));
  return result;
}

vec4 climateColor(vec3 color,float edge,vec2 wld,int zone){
  float el = elshade(edge,wld,zone);
  vec4 col;
  if(zone < 3)
    col.rgb = color*el*patchy(wld);
  else
    col.rgb = mix(color,elevation,0.7)*el*patchy(wld);
  col.a = 1.0;

  return col;
}

float noisy_dist(vec2 a,vec2 b){
  vec2 diff = b-a;
  return length(diff) + fbm(1.5*(normalize(diff) + a),3.0*0.13,0.7) + 3.0*0.13;
}

void main(void){
  vec2 wld = img2wld(tex2img(vTextureCoord.xy,filterArea));
  vec2 axl = wld2axl(wld);

  vec4 n23 = closest_neighbors(axl,wld);
  vec2 np1 = axl2wld(axl);
  vec2 np2 = axl2wld(n23.xy);
  vec2 np3 = axl2wld(n23.zw);

  float dist1 = noisy_dist(wld,np1);
  float dist2 = noisy_dist(wld,np2);
  float dist3 = noisy_dist(wld,np3);
  float edge;
  vec2 hex;
  if(dist1 < dist2 && dist1 < dist3){
    if(dist2 < dist3) edge = dist2 - dist1;
    else edge = dist3 - dist1;
    hex = axl2hex(axl);
  }
  else if(dist2 < dist3){
    if(dist3 < dist1) edge = dist3 - dist2;
    else edge = dist1 - dist2;
    hex = axl2hex(n23.xy);
  }
  else{
    if(dist2 < dist1) edge = dist2 - dist3;
    else edge = dist1 - dist3;
    hex = axl2hex(n23.zw);
  }

  if(hex.x < 0.0 || hex.y < 0.0 || hex.x >= map_dims.x || hex.y >= map_dims.y)
    gl_FragColor = vec4(1.0,1.0,1.0,1.0);
  else{
    vec4 tex  = texture2D(uSampler,hex2dat(hex,filterArea));
    int zone = int(255.0*tex.x)-1;
    float depth = tex.y;
    int vegetation = int(255.0*tex.z / 8.0)-1;
    int climate = int(mod(255.0*tex.z,8.0))-1;

    if(zone == 0)
      gl_FragColor = zoneColor(zone_h_0,zone_s_0,depth)*elshade(edge,wld,zone);
    else{ // if(vegetation == 0){
      if(climate == 0) gl_FragColor = climateColor(climate0,edge,wld,zone);
      else if(climate == 1) gl_FragColor = climateColor(climate1,edge,wld,zone);
      else if(climate == 2) gl_FragColor = climateColor(climate2,edge,wld,zone);
      else if(climate == 3) gl_FragColor = climateColor(climate3,edge,wld,zone);
      else if(climate == 4) gl_FragColor = climateColor(climate4,edge,wld,zone);
      else if(climate == 5) gl_FragColor = climateColor(climate5,edge,wld,zone);
      else if(climate == 6) gl_FragColor = climateColor(climate6,edge,wld,zone);
    }
  }
  gl_FragColor.a = 1.0;
}
