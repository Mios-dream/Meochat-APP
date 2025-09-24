/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismMatrix44 } from '@framework/math/cubismmatrix44'
import { CubismViewMatrix } from '@framework/math/cubismviewmatrix'

import * as LAppDefine from './define'
import { LAppDelegate } from './delegate'
import { LAppPal } from './pal'
import { LAppSprite } from './sprite'
import { TextureInfo } from './texture_manager'
import { TouchManager } from './touch_manager'
import { LAppSubdelegate } from './subdelegate'

/**
 * 描画クラス。
 */
export class LAppView {
  /**
   * 视图构造函数
   */
  public constructor() {
    this._programId = null
    this._back = null

    // 触摸事件管理
    this._touchManager = new TouchManager()

    // 用于将设备坐标转换为屏幕坐标
    this._deviceToScreen = new CubismMatrix44()

    // 进行画面的显示的放大缩小和移动的变换的行列
    this._viewMatrix = new CubismViewMatrix()
  }

  /**
   * 初始化
   */
  public initialize(subdelegate: LAppSubdelegate): void {
    this._subdelegate = subdelegate
    const { width, height } = subdelegate.getCanvas()

    const ratio: number = width / height
    const left: number = -ratio
    const right: number = ratio
    const bottom: number = LAppDefine.ViewLogicalLeft
    const top: number = LAppDefine.ViewLogicalRight

    this._viewMatrix.setScreenRect(left, right, bottom, top) // デバイスに対応する画面の範囲。 Xの左端、Xの右端、Yの下端、Yの上端
    this._viewMatrix.scale(LAppDefine.ViewScale, LAppDefine.ViewScale)

    this._deviceToScreen.loadIdentity()
    if (width > height) {
      const screenW: number = Math.abs(right - left)
      this._deviceToScreen.scaleRelative(screenW / width, -screenW / width)
    } else {
      const screenH: number = Math.abs(top - bottom)
      this._deviceToScreen.scaleRelative(screenH / height, -screenH / height)
    }
    this._deviceToScreen.translateRelative(-width * 0.5, -height * 0.5)

    // 表示範囲の設定
    this._viewMatrix.setMaxScale(LAppDefine.ViewMaxScale) // 限界拡張率
    this._viewMatrix.setMinScale(LAppDefine.ViewMinScale) // 限界縮小率

    // 表示できる最大範囲
    this._viewMatrix.setMaxScreenRect(
      LAppDefine.ViewLogicalMaxLeft,
      LAppDefine.ViewLogicalMaxRight,
      LAppDefine.ViewLogicalMaxBottom,
      LAppDefine.ViewLogicalMaxTop,
    )
  }

  /**
   * 释放资源
   */
  public release(): void {
    this._viewMatrix = null
    this._touchManager = null
    this._deviceToScreen = null

    this._back.release()
    this._back = null

    this._subdelegate.getGlManager().getGl().deleteProgram(this._programId)
    this._programId = null
  }

  /**
   * 绘制
   */
  public render(): void {
    const gl = this._subdelegate.getGlManager().getGl()
    // 背景绘制
    if (this._back) {
      this._back.render(this._programId)
    }

    gl.flush()

    const lapplive2dmanager = this._subdelegate.getLive2DManager()
    if (lapplive2dmanager != null) {
      lapplive2dmanager.setViewMatrix(this._viewMatrix)

      lapplive2dmanager.onUpdate()
    }
  }

  /**
   * 进行背景图像的初始化。
   */
  public initializeSprite(): void {
    const width: number = this._subdelegate.getCanvas().width
    const height: number = this._subdelegate.getCanvas().height
    const textureManager = this._subdelegate.getTextureManager()
    const resourcesPath = LAppDefine.ResourcesPath

    let imageName = ''

    // 背景画像初始化
    // imageName = LAppDefine.BackImageName

    // // 因为是异步的，所以创建回调函数
    // const initBackGroundTexture = (textureInfo: TextureInfo): void => {
    //   const x: number = width * 0.5
    //   const y: number = height * 0.5

    //   const fwidth = textureInfo.width * 2.0
    //   const fheight = height * 0.95
    //   this._back = new LAppSprite(x, y, fwidth, fheight, textureInfo.id)
    //   this._back.setSubdelegate(this._subdelegate)
    // }

    // textureManager.createTextureFromPngFile(resourcesPath + imageName, false, initBackGroundTexture)

    // // 齿轮图像初始化
    // imageName = LAppDefine.GearImageName
    // const initGearTexture = (textureInfo: TextureInfo): void => {
    //   const x = width - textureInfo.width * 0.5
    //   const y = height - textureInfo.height * 0.5
    //   const fwidth = textureInfo.width
    //   const fheight = textureInfo.height
    //   this._gear = new LAppSprite(x, y, fwidth, fheight, textureInfo.id)
    //   this._gear.setSubdelegate(this._subdelegate)
    // }

    // textureManager.createTextureFromPngFile(resourcesPath + imageName, false, initGearTexture)

    // // シェーダーを作成
    // if (this._programId == null) {
    //   this._programId = this._subdelegate.createShader()
    // }
  }

  /**
   * 被触摸的时候被调用。
   *
   * @param pointX スクリーンX座標
   * @param pointY スクリーンY座標
   */
  public onTouchesBegan(pointX: number, pointY: number): void {
    this._touchManager.touchesBegan(
      pointX * window.devicePixelRatio,
      pointY * window.devicePixelRatio,
    )
  }

  /**
   * 触摸的时候指针移动的话被调用。
   *
   * @param pointX スクリーンX座標
   * @param pointY スクリーンY座標
   */
  public onTouchesMoved(pointX: number, pointY: number): void {
    const posX = pointX * window.devicePixelRatio
    const posY = pointY * window.devicePixelRatio

    const lapplive2dmanager = this._subdelegate.getLive2DManager()

    const viewX: number = this.transformViewX(this._touchManager.getX())
    const viewY: number = this.transformViewY(this._touchManager.getY())

    this._touchManager.touchesMoved(posX, posY)

    lapplive2dmanager.onDrag(viewX, viewY)
  }

  /**
   * 触摸结束后被调用。
   *
   * @param pointX スクリーンX座標
   * @param pointY スクリーンY座標
   */
  public onTouchesEnded(pointX: number, pointY: number): void {
    const posX = pointX * window.devicePixelRatio
    const posY = pointY * window.devicePixelRatio

    const lapplive2dmanager = this._subdelegate.getLive2DManager()

    // タッチ終了
    lapplive2dmanager.onDrag(0.0, 0.0)

    // シングルタップ
    const x: number = this.transformViewX(posX)
    const y: number = this.transformViewY(posY)

    if (LAppDefine.DebugTouchLogEnable) {
      LAppPal.printMessage(`[APP]touchesEnded x: ${x} y: ${y}`)
    }
    lapplive2dmanager.onTap(x, y)

    // 点击了齿轮，调用live2D管理器切换人物模型
    // if (this._gear.isHit(posX, posY)) {
    //   lapplive2dmanager.nextScene()
    // }
  }

  /**
   * X座標をView座標に変換する。
   *
   * @param deviceX デバイスX座標
   */
  public transformViewX(deviceX: number): number {
    const screenX: number = this._deviceToScreen.transformX(deviceX) // 論理座標変換した座標を取得。
    return this._viewMatrix.invertTransformX(screenX) // 拡大、縮小、移動後の値。
  }

  /**
   * Y座標をView座標に変換する。
   *
   * @param deviceY デバイスY座標
   */
  public transformViewY(deviceY: number): number {
    const screenY: number = this._deviceToScreen.transformY(deviceY) // 論理座標変換した座標を取得。
    return this._viewMatrix.invertTransformY(screenY)
  }

  /**
   * X座標をScreen座標に変換する。
   * @param deviceX デバイスX座標
   */
  public transformScreenX(deviceX: number): number {
    return this._deviceToScreen.transformX(deviceX)
  }

  /**
   * Y座標をScreen座標に変換する。
   *
   * @param deviceY デバイスY座標
   */
  public transformScreenY(deviceY: number): number {
    return this._deviceToScreen.transformY(deviceY)
  }

  _touchManager: TouchManager // 触摸管理器
  _deviceToScreen: CubismMatrix44 // 从设备到屏幕的矩阵
  _viewMatrix: CubismViewMatrix // viewMatrix
  _programId: WebGLProgram // 明暗器ID
  _back: LAppSprite // 背景画像
  // _gear: LAppSprite // 齿轮图像
  _changeModel: boolean // 模型切换标志
  _isClick: boolean // 是否点击
  private _subdelegate: LAppSubdelegate
}
