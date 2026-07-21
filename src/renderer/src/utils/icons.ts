/**
 * FontAwesome 图标按需注册
 *
 * 仅注册项目中实际使用的图标，避免全量加载 fas(~1000) 和 far(~800) 导致的
 * 包体积膨胀和 V8 堆内存浪费。每个窗口的入口文件都应调用此函数代替
 * library.add(fas) + library.add(far)。
 *
 * 使用方式：
 *   在 main.ts / assistant_main.ts 等入口文件中：
 *     import { registerIcons } from './utils/icons'
 *     registerIcons()
 *
 * 如需新增图标：
 *   1. 在下方对应数组中添加 import
 *   2. 加入 library.add() 调用中
 */
import { library } from '@fortawesome/fontawesome-svg-core'
// fas — 逐个导入实际使用的图标
import { faArrowDown } from '@fortawesome/free-solid-svg-icons/faArrowDown'
import { faArrowsRotate } from '@fortawesome/free-solid-svg-icons/faArrowsRotate'
import { faBolt } from '@fortawesome/free-solid-svg-icons/faBolt'
import { faBook } from '@fortawesome/free-solid-svg-icons/faBook'
import { faBox } from '@fortawesome/free-solid-svg-icons/faBox'
import { faBoxOpen } from '@fortawesome/free-solid-svg-icons/faBoxOpen'
import { faCamera } from '@fortawesome/free-solid-svg-icons/faCamera'
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck'
import { faCheckCircle } from '@fortawesome/free-solid-svg-icons/faCheckCircle'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown'
import { faChevronRight } from '@fortawesome/free-solid-svg-icons/faChevronRight'
import { faCircleCheck } from '@fortawesome/free-solid-svg-icons/faCircleCheck'
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons/faCircleExclamation'
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons/faCircleNotch'
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock'
import { faCloud } from '@fortawesome/free-solid-svg-icons/faCloud'
import { faCloudBolt } from '@fortawesome/free-solid-svg-icons/faCloudBolt'
import { faCloudMeatball } from '@fortawesome/free-solid-svg-icons/faCloudMeatball'
import { faCloudRain } from '@fortawesome/free-solid-svg-icons/faCloudRain'
import { faCloudShowersHeavy } from '@fortawesome/free-solid-svg-icons/faCloudShowersHeavy'
import { faCloudSun } from '@fortawesome/free-solid-svg-icons/faCloudSun'
import { faCommentDots } from '@fortawesome/free-solid-svg-icons/faCommentDots'
import { faComments } from '@fortawesome/free-solid-svg-icons/faComments'
import { faCopy } from '@fortawesome/free-solid-svg-icons/faCopy'
import { faCubes } from '@fortawesome/free-solid-svg-icons/faCubes'
import { faDatabase } from '@fortawesome/free-solid-svg-icons/faDatabase'
import { faDownload } from '@fortawesome/free-solid-svg-icons/faDownload'
import { faEraser } from '@fortawesome/free-solid-svg-icons/faEraser'
import { faExclamationCircle } from '@fortawesome/free-solid-svg-icons/faExclamationCircle'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons/faExclamationTriangle'
import { faFile } from '@fortawesome/free-solid-svg-icons/faFile'
import { faFileLines } from '@fortawesome/free-solid-svg-icons/faFileLines'
import { faFileZipper } from '@fortawesome/free-solid-svg-icons/faFileZipper'
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons/faFolderOpen'
import { faFont } from '@fortawesome/free-solid-svg-icons/faFont'
import { faGear } from '@fortawesome/free-solid-svg-icons/faGear'
import { faHeart } from '@fortawesome/free-solid-svg-icons/faHeart'
import { faHouse } from '@fortawesome/free-solid-svg-icons/faHouse'
import { faImage } from '@fortawesome/free-solid-svg-icons/faImage'
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons/faInfoCircle'
import { faListCheck } from '@fortawesome/free-solid-svg-icons/faListCheck'
import { faLocationDot } from '@fortawesome/free-solid-svg-icons/faLocationDot'
import { faLock } from '@fortawesome/free-solid-svg-icons/faLock'
import { faMessage } from '@fortawesome/free-solid-svg-icons/faMessage'
import { faMicrochip } from '@fortawesome/free-solid-svg-icons/faMicrochip'
import { faMicrophone } from '@fortawesome/free-solid-svg-icons/faMicrophone'
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons/faPaperPlane'
import { faPaperclip } from '@fortawesome/free-solid-svg-icons/faPaperclip'
import { faPaw } from '@fortawesome/free-solid-svg-icons/faPaw'
import { faPen } from '@fortawesome/free-solid-svg-icons/faPen'
import { faPenToSquare } from '@fortawesome/free-solid-svg-icons/faPenToSquare'
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay'
import { faPlug } from '@fortawesome/free-solid-svg-icons/faPlug'
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus'
import { faPuzzlePiece } from '@fortawesome/free-solid-svg-icons/faPuzzlePiece'
import { faQuoteLeft } from '@fortawesome/free-solid-svg-icons/faQuoteLeft'
import { faRotate } from '@fortawesome/free-solid-svg-icons/faRotate'
import { faRotateRight } from '@fortawesome/free-solid-svg-icons/faRotateRight'
import { faSatellite } from '@fortawesome/free-solid-svg-icons/faSatellite'
import { faScroll } from '@fortawesome/free-solid-svg-icons/faScroll'
import { faSliders } from '@fortawesome/free-solid-svg-icons/faSliders'
import { faSmog } from '@fortawesome/free-solid-svg-icons/faSmog'
import { faSnowflake } from '@fortawesome/free-solid-svg-icons/faSnowflake'
import { faSpinner } from '@fortawesome/free-solid-svg-icons/faSpinner'
import { faStickyNote } from '@fortawesome/free-solid-svg-icons/faStickyNote'
import { faStop } from '@fortawesome/free-solid-svg-icons/faStop'
import { faSun } from '@fortawesome/free-solid-svg-icons/faSun'
import { faTerminal } from '@fortawesome/free-solid-svg-icons/faTerminal'
import { faThumbtack } from '@fortawesome/free-solid-svg-icons/faThumbtack'
import { faTimes } from '@fortawesome/free-solid-svg-icons/faTimes'
import { faTrash } from '@fortawesome/free-solid-svg-icons/faTrash'
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons/faTriangleExclamation'
import { faUnlock } from '@fortawesome/free-solid-svg-icons/faUnlock'
import { faUser } from '@fortawesome/free-solid-svg-icons/faUser'
import { faUserCircle } from '@fortawesome/free-solid-svg-icons/faUserCircle'
import { faVolumeHigh } from '@fortawesome/free-solid-svg-icons/faVolumeHigh'
import { faVolumeXmark } from '@fortawesome/free-solid-svg-icons/faVolumeXmark'
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons/faWandMagicSparkles'
import { faWind } from '@fortawesome/free-solid-svg-icons/faWind'
import { faWrench } from '@fortawesome/free-solid-svg-icons/faWrench'
import { faXmark } from '@fortawesome/free-solid-svg-icons/faXmark'

export function registerIcons(): void {
  library.add(
    faArrowDown,
    faArrowsRotate,
    faBolt,
    faBook,
    faBox,
    faBoxOpen,
    faCamera,
    faCheck,
    faCheckCircle,
    faChevronDown,
    faChevronRight,
    faCircleCheck,
    faCircleExclamation,
    faCircleNotch,
    faClock,
    faCloud,
    faCloudBolt,
    faCloudMeatball,
    faCloudRain,
    faCloudShowersHeavy,
    faCloudSun,
    faCommentDots,
    faComments,
    faCopy,
    faCubes,
    faDatabase,
    faDownload,
    faEraser,
    faExclamationCircle,
    faExclamationTriangle,
    faFile,
    faFileLines,
    faFileZipper,
    faFolderOpen,
    faFont,
    faGear,
    faHeart,
    faHouse,
    faImage,
    faInfoCircle,
    faListCheck,
    faLocationDot,
    faLock,
    faMessage,
    faMicrochip,
    faMicrophone,
    faPaperPlane,
    faPaperclip,
    faPaw,
    faPen,
    faPenToSquare,
    faPlay,
    faPlug,
    faPlus,
    faPuzzlePiece,
    faQuoteLeft,
    faRotate,
    faRotateRight,
    faSatellite,
    faScroll,
    faSliders,
    faSmog,
    faSnowflake,
    faSpinner,
    faStickyNote,
    faStop,
    faSun,
    faTerminal,
    faThumbtack,
    faTimes,
    faTrash,
    faTriangleExclamation,
    faUnlock,
    faUser,
    faUserCircle,
    faVolumeHigh,
    faVolumeXmark,
    faWandMagicSparkles,
    faWind,
    faWrench,
    faXmark
  )
}
