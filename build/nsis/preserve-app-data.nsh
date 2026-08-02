; ============================================================================
; MoeChat 自定义 NSIS 脚本：升级 / 卸载时保留 exe 同级的 appData/（模型数据）
; ----------------------------------------------------------------------------
; 背景：
;   MoeChat 的模型等大体积数据存放在 exe 同级目录 appData/ 下（见
;   src/main/utils/pathResolve.ts 的 resolveAppDataDir），用于把数据放在用户
;   指定的磁盘、避免占用系统盘。
;   electron-builder 默认卸载逻辑会 RMDir /r $INSTDIR 递归删除整个安装目录，
;   导致"便携完整版 + Lite 安装包就地升级"时 appData/ 中的模型被误删。
;
; 方案：
;   通过 electron-builder 的 nsis.include 注入本文件，定义 customRemoveFiles
;   宏替换默认的整目录删除逻辑：仅删除 $INSTDIR 下除 appData/ 外的所有内容，
;   从而在升级（旧卸载器以 --updated 运行）与手动卸载时都保留模型数据。
;
; 注意：
;   该宏替换后不再使用 electron-builder 的 isUpdated 整目录改名回退策略，
;   升级时需确保应用已关闭（assisted 安装器已做进程占用检查）。
; ============================================================================

; 递归删除 $INSTDIR 下除 appData 外的所有文件与子目录（卸载器上下文，函数带 un. 前缀）
; 仅在生成独立卸载器（BUILD_UNINSTALLER 阶段）时定义；
; 主安装包阶段不引入任何 un. 代码，避免 NSIS 6020 警告（有卸载器代码却无 WriteUninstaller）
!ifdef BUILD_UNINSTALLER
Function un.RemoveInstDirExceptData
  Push $R0
  Push $R1

  FindFirst $R0 $R1 "$INSTDIR\*"
  loop:
    StrCmp $R1 "" done
    StrCmp $R1 "." next
    StrCmp $R1 ".." next
    StrCmp $R1 "appData" next
    IfFileExists "$INSTDIR\$R1\*" 0 notdir
    RMDir /r "$INSTDIR\$R1"
    Goto next
  notdir:
    Delete "$INSTDIR\$R1"
  next:
    FindNext $R0 $R1
    Goto loop
  done:
    FindClose $R0
    Pop $R1
    Pop $R0
FunctionEnd

; 替换默认"删除全部安装目录"逻辑：
;   - 升级（--updated）：保留 appData/（模型数据），仅删除其余内容
;   - 手动卸载（无 --updated）：删除整个安装目录（含 appData/，符合用户预期"卸载即清理"）
; 注意：电子升级（electron-updater）调用旧卸载器时同样带 --updated，因此自动升级也走"保留"分支。
!macro customRemoveFiles
  ${if} ${isUpdated}
    Call un.RemoveInstDirExceptData
  ${else}
    RMDir /r "$INSTDIR"
  ${endif}
!macroend
!endif
