/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { csmVector } from '@framework/type/csmvector'
import { CubismFramework, Option } from '@framework/live2dcubismframework'
import * as LAppDefine from './define'
import { LAppPal } from './pal'
import { LAppSubdelegate } from './subdelegate'
import { CubismLogError } from '@framework/utils/cubismdebug'

export let s_instance: LAppDelegate = null

/**
 *应用程序类。
 * Cubism SDK的管理。
 */
export class LAppDelegate {
  /**
   *返回类的实例（单例）。
   *如果未生成实例，则在内部生成实例。
   *
   * @return クラスのインスタンス
   */
  public static getInstance(): LAppDelegate {
    if (s_instance == null) {
      s_instance = new LAppDelegate()
    }

    return s_instance
  }

  /**
   * 释放实例
   */
  public static releaseInstance(): void {
    if (s_instance != null) {
      s_instance.release()
    }

    s_instance = null
  }

  /**
   * 指针激活时被调用。
   */
  private onPointerBegan(e: PointerEvent): void {
    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().onPointBegan(e.pageX, e.pageY)
    }
  }

  /**
   * 指针移动时调用
   */
  private onPointerMoved(e: PointerEvent): void {
    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().onPointMoved(e.pageX, e.pageY)
    }
  }

  /**
   * 指针抬起时调用。
   */
  private onPointerEnded(e: PointerEvent): void {
    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().onPointEnded(e.pageX, e.pageY)
    }
  }

  /**
   * 当指针被取消时调用。
   */
  private onPointerCancel(e: PointerEvent): void {
    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().onTouchCancel(e.pageX, e.pageY)
    }
  }

  /**
   * 调整画布大小并重新初始化视图。
   */
  public onResize(): void {
    for (let i = 0; i < this._subdelegates.getSize(); i++) {
      this._subdelegates.at(i).onResize()
    }
  }

  /**
   * 执行处理。
   */
  public run(): void {
    // 主循环
    const loop = (): void => {
      // 确认是否存在实例
      if (s_instance == null) {
        return
      }

      // 时间更新
      LAppPal.updateTime()

      for (let i = 0; i < this._subdelegates.getSize(); i++) {
        this._subdelegates.at(i).update()
      }

      // 循环的递归调用
      requestAnimationFrame(loop)
    }
    loop()
  }

  /**
   * 释放
   */
  private release(): void {
    this.releaseEventListener()
    this.releaseSubdelegates()

    // Cubism SDKの解放
    CubismFramework.dispose()

    this._cubismOption = null
  }

  /**
   * 解除事件侦听器。
   */
  private releaseEventListener(): void {
    document.removeEventListener('pointerup', this.pointBeganEventListener)
    this.pointBeganEventListener = null
    document.removeEventListener('pointermove', this.pointMovedEventListener)
    this.pointMovedEventListener = null
    document.removeEventListener('pointerdown', this.pointEndedEventListener)
    this.pointEndedEventListener = null
    document.removeEventListener('pointerdown', this.pointCancelEventListener)
    this.pointCancelEventListener = null
  }

  /**
   * Subdelegate 释放
   */
  private releaseSubdelegates(): void {
    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().release()
    }

    this._subdelegates.clear()
    this._subdelegates = null
  }

  /**
   * APP初始化所需的东西。
   * 创建canvas并初始化视图。
   * width: 画布宽度(占视口的比例)
   * height: 画布高度(占视口的比例)
   */
  public initialize(width: number, height: number): boolean {
    // Cubism SDKの初期化
    this.initializeCubism()
    this.initializeSubdelegates(width, height)
    this.initializeEventListener()

    return true
  }

  /**
   * 设置事件侦听器。
   */
  private initializeEventListener(): void {
    this.pointBeganEventListener = this.onPointerBegan.bind(this)
    this.pointMovedEventListener = this.onPointerMoved.bind(this)
    this.pointEndedEventListener = this.onPointerEnded.bind(this)
    this.pointCancelEventListener = this.onPointerCancel.bind(this)

    // 指针相关回调函数注册
    document.addEventListener('pointerdown', this.pointBeganEventListener, {
      passive: true,
    })
    document.addEventListener('pointermove', this.pointMovedEventListener, {
      passive: true,
    })
    document.addEventListener('pointerup', this.pointEndedEventListener, {
      passive: true,
    })
    document.addEventListener('pointercancel', this.pointCancelEventListener, {
      passive: true,
    })
  }

  /**
   * Cubism SDKの初期化
   */
  private initializeCubism(): void {
    LAppPal.updateTime()

    // setup cubism
    this._cubismOption.logFunction = LAppPal.printMessage
    this._cubismOption.loggingLevel = LAppDefine.CubismLoggingLevel
    CubismFramework.startUp(this._cubismOption)

    // initialize cubism
    CubismFramework.initialize()
  }

  /**
   * Canvas生成配置、Subdelegate初期化
   */
  private initializeSubdelegates(width: number = 100, height: number = 80): void {
    if (LAppDefine.CanvasNum > 3) {
      const widthUnit: number = Math.ceil(Math.sqrt(LAppDefine.CanvasNum))
      const heightUnit = Math.ceil(LAppDefine.CanvasNum / widthUnit)
      width = 100.0 / widthUnit
      height = 100.0 / heightUnit
    } else {
      width = 100.0 / LAppDefine.CanvasNum
    }

    this._canvases.prepareCapacity(LAppDefine.CanvasNum)
    this._subdelegates.prepareCapacity(LAppDefine.CanvasNum)
    for (let i = 0; i < LAppDefine.CanvasNum; i++) {
      const canvas = document.createElement('canvas')
      this._canvases.pushBack(canvas)
      canvas.style.width = `${width}vw`
      canvas.style.height = `${height}vh`
      canvas.style.bottom = '0'
      canvas.style.position = 'fixed'
      canvas.id = `live2d`
      // 添加canvas元素到页面
      document.getElementById('live2d-container')?.appendChild(canvas)
      // document.body.appendChild(canvas)
    }

    for (let i = 0; i < this._canvases.getSize(); i++) {
      const subdelegate = new LAppSubdelegate()
      subdelegate.initialize(this._canvases.at(i))
      this._subdelegates.pushBack(subdelegate)
    }

    for (let i = 0; i < LAppDefine.CanvasNum; i++) {
      if (this._subdelegates.at(i).isContextLost()) {
        CubismLogError(
          `The context for Canvas at index ${i} was lost, possibly because the acquisition limit for WebGLRenderingContext was reached.`,
        )
      }
    }
  }

  /**
   * 获取Subdelegate
   * @param index
   */
  public getSubdelegate(index: number): LAppSubdelegate {
    return this._subdelegates.at(index)
  }

  /**
   * Privateなコンストラクタ
   */
  private constructor() {
    this._cubismOption = new Option()
    this._subdelegates = new csmVector<LAppSubdelegate>()
    this._canvases = new csmVector<HTMLCanvasElement>()
  }

  /**
   * Cubism SDK Option
   */
  private _cubismOption: Option

  /**
   * 操作対象のcanvas要素
   */
  private _canvases: csmVector<HTMLCanvasElement>

  /**
   * Subdelegate
   */
  private _subdelegates: csmVector<LAppSubdelegate>

  /**
   * 登録済みイベントリスナー 関数オブジェクト
   */
  private pointBeganEventListener: (this: Document, ev: PointerEvent) => void

  /**
   * 登録済みイベントリスナー 関数オブジェクト
   */
  private pointMovedEventListener: (this: Document, ev: PointerEvent) => void

  /**
   * 登録済みイベントリスナー 関数オブジェクト
   */
  private pointEndedEventListener: (this: Document, ev: PointerEvent) => void

  /**
   * 登録済みイベントリスナー 関数オブジェクト
   */
  private pointCancelEventListener: (this: Document, ev: PointerEvent) => void
}
