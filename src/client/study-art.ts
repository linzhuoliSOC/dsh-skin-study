/**
 * 质感书房插画：两张扁平矢量 SVG（亮/暗），由 index.ts 编码为 data URI
 * 注入 body 的 CSS 变量（--dsh-study-art-light / --dsh-study-art-dark），
 * study.css 把它们铺为 #root（房间）的背景。构图：透光窗 + 窗下书桌台灯 +
 * 右侧书架 + 左角绿植 + 木地板与地毯；暗色版为夜晚书房，只留台灯暖光。
 * 属性统一用单引号，encodeURIComponent 后可直接放进 url("...")。
 */

/** 亮色版：奶白墙面、浅蓝窗景、日光斜照、胡桃木家具、低饱和书脊。 */
export const STUDY_ART_LIGHT = `
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 900'>
  <defs>
    <linearGradient id='wall' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0' stop-color='#f9f2e2'/><stop offset='1' stop-color='#f1e5cb'/>
    </linearGradient>
    <linearGradient id='sky' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0' stop-color='#cfe5f0'/><stop offset='.65' stop-color='#e9f2ea'/><stop offset='1' stop-color='#f7f0dc'/>
    </linearGradient>
    <linearGradient id='floor' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0' stop-color='#dec295'/><stop offset='1' stop-color='#c8a677'/>
    </linearGradient>
    <linearGradient id='wood' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0' stop-color='#c09a67'/><stop offset='1' stop-color='#ab8252'/>
    </linearGradient>
    <radialGradient id='glow' cx='.5' cy='.5' r='.5'>
      <stop offset='0' stop-color='#fff6d6'/><stop offset='1' stop-color='#fff6d6' stop-opacity='0'/>
    </radialGradient>
  </defs>
  <rect width='1440' height='900' fill='url(#wall)'/>
  <rect y='648' width='1440' height='252' fill='url(#floor)'/>
  <path d='M0 704h1440M0 768h1440M0 832h1440' stroke='#b2906040' stroke-width='5'/>
  <rect y='638' width='1440' height='14' fill='#cbb086'/>
  <ellipse cx='620' cy='810' rx='430' ry='72' fill='#ecdcb8'/>
  <ellipse cx='620' cy='810' rx='346' ry='56' fill='#e4d0a6'/>
  <path d='M392 512 748 512 990 900 540 900Z' fill='#fff1c8' opacity='.3'/>
  <rect x='330' y='104' width='440' height='392' rx='12' fill='#fdf7e6'/>
  <rect x='352' y='126' width='396' height='348' fill='url(#sky)'/>
  <circle cx='486' cy='232' r='128' fill='url(#glow)'/>
  <circle cx='486' cy='232' r='40' fill='#ffeec4'/>
  <ellipse cx='640' cy='208' rx='62' ry='18' fill='#ffffffd9'/>
  <ellipse cx='682' cy='238' rx='42' ry='13' fill='#ffffffb8'/>
  <ellipse cx='428' cy='330' rx='48' ry='14' fill='#ffffffa6'/>
  <path d='M550 126v348M352 300h396' stroke='#fdf7e6' stroke-width='14'/>
  <rect x='314' y='496' width='472' height='20' rx='7' fill='#e7d5ad'/>
  <rect x='300' y='566' width='520' height='24' rx='7' fill='url(#wood)'/>
  <rect x='332' y='590' width='18' height='104' fill='#987148'/>
  <rect x='770' y='590' width='18' height='104' fill='#987148'/>
  <rect x='382' y='534' width='94' height='15' rx='3' fill='#9db288'/>
  <rect x='388' y='519' width='80' height='15' rx='3' fill='#cf9377'/>
  <rect x='394' y='504' width='68' height='15' rx='3' fill='#93a8bf'/>
  <circle cx='726' cy='514' r='72' fill='url(#glow)'/>
  <ellipse cx='726' cy='560' rx='34' ry='8' fill='#8a6538'/>
  <rect x='722' y='478' width='8' height='82' fill='#8a6538'/>
  <path d='M696 478h60l-13-46h-34Z' fill='#eebd6e'/>
  <rect x='1058' y='172' width='254' height='478' rx='10' fill='url(#wood)'/>
  <rect x='1074' y='188' width='222' height='446' fill='#8f6a3e'/>
  <rect x='1074' y='300' width='222' height='10' fill='#c09a67'/>
  <rect x='1074' y='414' width='222' height='10' fill='#c09a67'/>
  <rect x='1074' y='528' width='222' height='10' fill='#c09a67'/>
  <rect x='1088' y='212' width='24' height='88' rx='3' fill='#b3816b'/>
  <rect x='1116' y='224' width='20' height='76' rx='3' fill='#9db288'/>
  <rect x='1140' y='206' width='26' height='94' rx='3' fill='#c9a86a'/>
  <rect x='1170' y='228' width='18' height='72' rx='3' fill='#93a8bf'/>
  <rect x='1192' y='216' width='22' height='84' rx='3' fill='#b8986e'/>
  <rect x='1090' y='334' width='22' height='80' rx='3' fill='#93a8bf'/>
  <rect x='1116' y='346' width='26' height='68' rx='3' fill='#cfa96a'/>
  <rect x='1146' y='326' width='20' height='88' rx='3' fill='#b3816b'/>
  <rect x='1238' y='378' width='28' height='36' rx='8' fill='#9db288'/>
  <rect x='1088' y='448' width='24' height='80' rx='3' fill='#cfa96a'/>
  <rect x='1116' y='440' width='20' height='88' rx='3' fill='#9db288'/>
  <rect x='1140' y='452' width='22' height='76' rx='3' fill='#93a8bf' transform='rotate(8 1151 528)'/>
  <rect x='1200' y='472' width='72' height='56' rx='6' fill='#b8986e'/>
  <rect x='1090' y='566' width='26' height='68' rx='3' fill='#b3816b'/>
  <rect x='1120' y='556' width='20' height='78' rx='3' fill='#c98f76'/>
  <rect x='1144' y='572' width='24' height='62' rx='3' fill='#cfa96a'/>
  <path d='M118 566h100l-13 96h-74Z' fill='#b5704f'/>
  <rect x='112' y='556' width='112' height='16' rx='6' fill='#c4805c'/>
  <ellipse cx='140' cy='496' rx='20' ry='70' fill='#7d9a5c' transform='rotate(-16 140 496)'/>
  <ellipse cx='196' cy='496' rx='20' ry='70' fill='#8aa868' transform='rotate(16 196 496)'/>
  <ellipse cx='168' cy='474' rx='22' ry='82' fill='#6f8b4f'/>
</svg>`

/** 暗色版：同一构图入夜——墙/地板转深可可，窗外变月夜，台灯成唯一暖光源。 */
export const STUDY_ART_DARK = `
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 900'>
  <defs>
    <linearGradient id='wall' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0' stop-color='#241c11'/><stop offset='1' stop-color='#1b140c'/>
    </linearGradient>
    <linearGradient id='sky' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0' stop-color='#1e2833'/><stop offset='.65' stop-color='#2c3844'/><stop offset='1' stop-color='#3a3f3c'/>
    </linearGradient>
    <linearGradient id='floor' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0' stop-color='#4a3722'/><stop offset='1' stop-color='#382916'/>
    </linearGradient>
    <linearGradient id='wood' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0' stop-color='#6b4f2d'/><stop offset='1' stop-color='#573f23'/>
    </linearGradient>
    <radialGradient id='glow' cx='.5' cy='.5' r='.5'>
      <stop offset='0' stop-color='#ffce7a'/><stop offset='1' stop-color='#ffce7a' stop-opacity='0'/>
    </radialGradient>
  </defs>
  <rect width='1440' height='900' fill='url(#wall)'/>
  <rect y='648' width='1440' height='252' fill='url(#floor)'/>
  <path d='M0 704h1440M0 768h1440M0 832h1440' stroke='#241a0e80' stroke-width='5'/>
  <rect y='638' width='1440' height='14' fill='#54402a'/>
  <ellipse cx='620' cy='810' rx='430' ry='72' fill='#3a2d1c'/>
  <ellipse cx='620' cy='810' rx='346' ry='56' fill='#443521'/>
  <path d='M660 512 792 512 900 900 600 900Z' fill='#d9a545' opacity='.12'/>
  <rect x='330' y='104' width='440' height='392' rx='12' fill='#463723'/>
  <rect x='352' y='126' width='396' height='348' fill='url(#sky)'/>
  <circle cx='486' cy='232' r='110' fill='#f0dfb222'/>
  <circle cx='486' cy='232' r='38' fill='#f0dfb2'/>
  <circle cx='474' cy='222' r='34' fill='#e2cd9a' opacity='.35'/>
  <circle cx='640' cy='200' r='3' fill='#e8dcc0'/>
  <circle cx='700' cy='260' r='2.5' fill='#e8dcc0cc'/>
  <circle cx='420' cy='340' r='2.5' fill='#e8dcc0b3'/>
  <circle cx='620' cy='330' r='2' fill='#e8dcc099'/>
  <circle cx='706' cy='170' r='2' fill='#e8dcc080'/>
  <path d='M550 126v348M352 300h396' stroke='#463723' stroke-width='14'/>
  <rect x='314' y='496' width='472' height='20' rx='7' fill='#54402a'/>
  <rect x='300' y='566' width='520' height='24' rx='7' fill='url(#wood)'/>
  <rect x='332' y='590' width='18' height='104' fill='#46351f'/>
  <rect x='770' y='590' width='18' height='104' fill='#46351f'/>
  <rect x='382' y='534' width='94' height='15' rx='3' fill='#5f6b4c'/>
  <rect x='388' y='519' width='80' height='15' rx='3' fill='#7a5343'/>
  <rect x='394' y='504' width='68' height='15' rx='3' fill='#4f5f73'/>
  <circle cx='726' cy='520' r='150' fill='url(#glow)' opacity='.5'/>
  <circle cx='726' cy='514' r='72' fill='url(#glow)'/>
  <ellipse cx='726' cy='560' rx='34' ry='8' fill='#3d2e1b'/>
  <rect x='722' y='478' width='8' height='82' fill='#3d2e1b'/>
  <path d='M696 478h60l-13-46h-34Z' fill='#d9a545'/>
  <rect x='1058' y='172' width='254' height='478' rx='10' fill='url(#wood)'/>
  <rect x='1074' y='188' width='222' height='446' fill='#2e2214'/>
  <rect x='1074' y='300' width='222' height='10' fill='#5f4729'/>
  <rect x='1074' y='414' width='222' height='10' fill='#5f4729'/>
  <rect x='1074' y='528' width='222' height='10' fill='#5f4729'/>
  <rect x='1088' y='212' width='24' height='88' rx='3' fill='#6e4f3d'/>
  <rect x='1116' y='224' width='20' height='76' rx='3' fill='#5f6b4c'/>
  <rect x='1140' y='206' width='26' height='94' rx='3' fill='#7d6440'/>
  <rect x='1170' y='228' width='18' height='72' rx='3' fill='#4f5f73'/>
  <rect x='1192' y='216' width='22' height='84' rx='3' fill='#6b5a3d'/>
  <rect x='1090' y='334' width='22' height='80' rx='3' fill='#4f5f73'/>
  <rect x='1116' y='346' width='26' height='68' rx='3' fill='#7d6440'/>
  <rect x='1146' y='326' width='20' height='88' rx='3' fill='#6e4f3d'/>
  <rect x='1238' y='378' width='28' height='36' rx='8' fill='#5c6b4a'/>
  <rect x='1088' y='448' width='24' height='80' rx='3' fill='#7d6440'/>
  <rect x='1116' y='440' width='20' height='88' rx='3' fill='#5f6b4c'/>
  <rect x='1140' y='452' width='22' height='76' rx='3' fill='#4f5f73' transform='rotate(8 1151 528)'/>
  <rect x='1200' y='472' width='72' height='56' rx='6' fill='#6b5232'/>
  <rect x='1090' y='566' width='26' height='68' rx='3' fill='#6e4f3d'/>
  <rect x='1120' y='556' width='20' height='78' rx='3' fill='#7a5343'/>
  <rect x='1144' y='572' width='24' height='62' rx='3' fill='#7d6440'/>
  <path d='M118 566h100l-13 96h-74Z' fill='#7a4a33'/>
  <rect x='112' y='556' width='112' height='16' rx='6' fill='#8a563b'/>
  <ellipse cx='140' cy='496' rx='20' ry='70' fill='#42532f' transform='rotate(-16 140 496)'/>
  <ellipse cx='196' cy='496' rx='20' ry='70' fill='#4c5e36' transform='rotate(16 196 496)'/>
  <ellipse cx='168' cy='474' rx='22' ry='82' fill='#3a4a2a'/>
</svg>`
