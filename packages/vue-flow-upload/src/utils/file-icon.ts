import sevenZipIcon from '../assets/file-icons/7z.svg?url'
import apkIcon from '../assets/file-icons/apk.svg?url'
import appxIcon from '../assets/file-icons/appx.svg?url'
import cabIcon from '../assets/file-icons/cab.svg?url'
import debIcon from '../assets/file-icons/deb.svg?url'
import dmgIcon from '../assets/file-icons/dmg.svg?url'
import ipaIcon from '../assets/file-icons/ipa.svg?url'
import isoIcon from '../assets/file-icons/iso.svg?url'
import jarIcon from '../assets/file-icons/jar.svg?url'
import msiIcon from '../assets/file-icons/msi.svg?url'
import rarIcon from '../assets/file-icons/rar.svg?url'
import rpmIcon from '../assets/file-icons/rpm.svg?url'
import zipIcon from '../assets/file-icons/zip.svg?url'
import azw3Icon from '../assets/file-icons/azw3.svg?url'
import chmIcon from '../assets/file-icons/chm.svg?url'
import csvIcon from '../assets/file-icons/csv.svg?url'
import djvuIcon from '../assets/file-icons/djvu.svg?url'
import docxIcon from '../assets/file-icons/docx.svg?url'
import epubIcon from '../assets/file-icons/epub.svg?url'
import hdf5Icon from '../assets/file-icons/hdf5.svg?url'
import mdIcon from '../assets/file-icons/md.svg?url'
import mobiIcon from '../assets/file-icons/mobi.svg?url'
import odpIcon from '../assets/file-icons/odp.svg?url'
import odsIcon from '../assets/file-icons/ods.svg?url'
import odtIcon from '../assets/file-icons/odt.svg?url'
import parquetIcon from '../assets/file-icons/parquet.svg?url'
import pdfIcon from '../assets/file-icons/pdf.svg?url'
import pptxIcon from '../assets/file-icons/pptx.svg?url'
import srtIcon from '../assets/file-icons/srt.svg?url'
import texIcon from '../assets/file-icons/tex.svg?url'
import tomlIcon from '../assets/file-icons/toml.svg?url'
import txtIcon from '../assets/file-icons/txt.svg?url'
import vttIcon from '../assets/file-icons/vtt.svg?url'
import xlsxIcon from '../assets/file-icons/xlsx.svg?url'
import xmlIcon from '../assets/file-icons/xml.svg?url'
import yamlIcon from '../assets/file-icons/yaml.svg?url'
import aiIcon from '../assets/file-icons/ai.svg?url'
import avifIcon from '../assets/file-icons/avif.svg?url'
import cdrIcon from '../assets/file-icons/cdr.svg?url'
import figIcon from '../assets/file-icons/fig.svg?url'
import gifIcon from '../assets/file-icons/gif.svg?url'
import heicIcon from '../assets/file-icons/heic.svg?url'
import inddIcon from '../assets/file-icons/indd.svg?url'
import jpgIcon from '../assets/file-icons/jpg.svg?url'
import pngIcon from '../assets/file-icons/png.svg?url'
import psdIcon from '../assets/file-icons/psd.svg?url'
import rawIcon from '../assets/file-icons/raw.svg?url'
import sketchIcon from '../assets/file-icons/sketch.svg?url'
import svgIcon from '../assets/file-icons/svg.svg?url'
import tiffIcon from '../assets/file-icons/tiff.svg?url'
import webpIcon from '../assets/file-icons/webp.svg?url'
import aviIcon from '../assets/file-icons/avi.svg?url'
import flacIcon from '../assets/file-icons/flac.svg?url'
import mkvIcon from '../assets/file-icons/mkv.svg?url'
import movIcon from '../assets/file-icons/mov.svg?url'
import mp3Icon from '../assets/file-icons/mp3.svg?url'
import mp4Icon from '../assets/file-icons/mp4.svg?url'
import oggIcon from '../assets/file-icons/ogg.svg?url'
import opusIcon from '../assets/file-icons/opus.svg?url'
import wavIcon from '../assets/file-icons/wav.svg?url'
import blendIcon from '../assets/file-icons/blend.svg?url'
import daeIcon from '../assets/file-icons/dae.svg?url'
import dwgIcon from '../assets/file-icons/dwg.svg?url'
import dxfIcon from '../assets/file-icons/dxf.svg?url'
import fbxIcon from '../assets/file-icons/fbx.svg?url'
import glbIcon from '../assets/file-icons/glb.svg?url'
import objIcon from '../assets/file-icons/obj.svg?url'
import stepIcon from '../assets/file-icons/step.svg?url'
import stlIcon from '../assets/file-icons/stl.svg?url'
import cssIcon from '../assets/file-icons/css.svg?url'
import dbIcon from '../assets/file-icons/db.svg?url'
import htmlIcon from '../assets/file-icons/html.svg?url'
import ipynbIcon from '../assets/file-icons/ipynb.svg?url'
import jsIcon from '../assets/file-icons/js.svg?url'
import jsonIcon from '../assets/file-icons/json.svg?url'
import sqlIcon from '../assets/file-icons/sql.svg?url'
import sqliteIcon from '../assets/file-icons/sqlite.svg?url'
import wasmIcon from '../assets/file-icons/wasm.svg?url'
import audioIcon from '../assets/file-icons/audio.svg?url'
import documentIcon from '../assets/file-icons/document.svg?url'
import imageIcon from '../assets/file-icons/image.svg?url'
import videoIcon from '../assets/file-icons/video.svg?url'

/**
 * 扩展名到内置图标的映射，键为小写且不含点；扩展名优先于 MIME，因为用户更关心文件的最终形态。
 * Extension-to-icon map keyed by lowercase extensions without the dot; extensions win over MIME because the final file form matters more to users.
 */
const EXTENSION_ICON_URLS: Readonly<Record<string, string>> = {
  // 压缩包与安装包 / Archives and installers
  '7z': sevenZipIcon,
  apk: apkIcon,
  appx: appxIcon,
  cab: cabIcon,
  deb: debIcon,
  dmg: dmgIcon,
  ipa: ipaIcon,
  iso: isoIcon,
  jar: jarIcon,
  msi: msiIcon,
  rar: rarIcon,
  rpm: rpmIcon,
  zip: zipIcon,
  tar: zipIcon,
  gz: zipIcon,
  tgz: zipIcon,
  bz2: zipIcon,
  xz: zipIcon,
  // 文档与办公 / Documents and office files
  azw3: azw3Icon,
  chm: chmIcon,
  csv: csvIcon,
  djvu: djvuIcon,
  docx: docxIcon,
  epub: epubIcon,
  hdf5: hdf5Icon,
  md: mdIcon,
  mobi: mobiIcon,
  odp: odpIcon,
  ods: odsIcon,
  odt: odtIcon,
  parquet: parquetIcon,
  pdf: pdfIcon,
  pptx: pptxIcon,
  srt: srtIcon,
  tex: texIcon,
  toml: tomlIcon,
  txt: txtIcon,
  vtt: vttIcon,
  xlsx: xlsxIcon,
  xml: xmlIcon,
  yaml: yamlIcon,
  doc: docxIcon,
  dot: docxIcon,
  dotx: docxIcon,
  rtf: docxIcon,
  xls: xlsxIcon,
  xlsm: xlsxIcon,
  ppt: pptxIcon,
  pps: pptxIcon,
  ppsx: pptxIcon,
  markdown: mdIcon,
  yml: yamlIcon,
  log: txtIcon,
  ini: tomlIcon,
  cfg: tomlIcon,
  // 图片与设计稿 / Images and design files
  ai: aiIcon,
  avif: avifIcon,
  cdr: cdrIcon,
  fig: figIcon,
  gif: gifIcon,
  heic: heicIcon,
  indd: inddIcon,
  jpg: jpgIcon,
  png: pngIcon,
  psd: psdIcon,
  raw: rawIcon,
  sketch: sketchIcon,
  svg: svgIcon,
  tiff: tiffIcon,
  webp: webpIcon,
  jpeg: jpgIcon,
  jpe: jpgIcon,
  tif: tiffIcon,
  bmp: imageIcon,
  ico: imageIcon,
  // 音视频 / Audio and video
  avi: aviIcon,
  flac: flacIcon,
  mkv: mkvIcon,
  mov: movIcon,
  mp3: mp3Icon,
  mp4: mp4Icon,
  ogg: oggIcon,
  opus: opusIcon,
  wav: wavIcon,
  m4a: audioIcon,
  aac: audioIcon,
  wma: audioIcon,
  webm: videoIcon,
  mpeg: videoIcon,
  mpg: videoIcon,
  m4v: videoIcon,
  // 三维与 CAD / 3D and CAD
  blend: blendIcon,
  dae: daeIcon,
  dwg: dwgIcon,
  dxf: dxfIcon,
  fbx: fbxIcon,
  glb: glbIcon,
  obj: objIcon,
  step: stepIcon,
  stl: stlIcon,
  // 数据与代码 / Data and code
  css: cssIcon,
  db: dbIcon,
  html: htmlIcon,
  ipynb: ipynbIcon,
  js: jsIcon,
  json: jsonIcon,
  sql: sqlIcon,
  sqlite: sqliteIcon,
  wasm: wasmIcon,
  htm: htmlIcon,
  ts: jsIcon,
  tsx: jsIcon,
  jsx: jsIcon,
  mjs: jsIcon,
  cjs: jsIcon,
  scss: cssIcon,
  less: cssIcon,
  // 代码与纯文本的常见别名。 Common aliases for code and plain text.
  conf: tomlIcon,
}

/**
 * 判断映射中是否真实存在该扩展名，避免命中 `__proto__`、`constructor` 等原型链属性。
 * Checks own keys so prototype names such as `__proto__` or `constructor` cannot match.
 */
function hasOwnExtension(extension: string): boolean {
  return Object.hasOwn(EXTENSION_ICON_URLS, extension)
}

/**
 * 按小写扩展名查找专属图标；未登记时返回 undefined，交给 MIME 回退。
 * Finds an icon for a lowercase extension, returning undefined so the MIME fallback can take over.
 */
export function findExtensionIconUrl(extension: string): string | undefined {
  return hasOwnExtension(extension) ? EXTENSION_ICON_URLS[extension] : undefined
}

/**
 * 缺少可用扩展名时按 MIME 类别回退；Office 类型复用对应扩展名图标，保持与旧版本一致。
 * Falls back to category icons by MIME type; Office types reuse their extension icons to preserve previous behavior.
 */
export function findMimeIconUrl(mimeType: string): string | undefined {
  // 统一小写，避免外部 File 对象给出大小写不一致的 MIME 值。
  // Lowercase the value so inconsistent MIME casing from external File objects still matches.
  const type = mimeType.toLowerCase()
  if (!type) return undefined
  if (type === 'application/pdf') return pdfIcon
  if (type.includes('word') || type.includes('opendocument.text')) return docxIcon
  if (
    type.includes('excel') ||
    type.includes('spreadsheet') ||
    type.includes('opendocument.spreadsheet')
  )
    return xlsxIcon
  if (
    type.includes('powerpoint') ||
    type.includes('presentation') ||
    type.includes('opendocument.presentation')
  )
    return pptxIcon
  if (type.startsWith('audio/')) return audioIcon
  if (type.startsWith('video/')) return videoIcon
  if (type.startsWith('image/')) return imageIcon
  if (type.includes('zip') || type.includes('compressed') || type.includes('archive'))
    return zipIcon
  if (type.includes('json') || type.includes('xml') || type.includes('javascript')) return jsonIcon
  if (type.startsWith('text/')) return documentIcon
  return undefined
}
