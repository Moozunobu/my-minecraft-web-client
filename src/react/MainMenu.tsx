import React, { useEffect, useMemo } from 'react'
import { useSnapshot } from 'valtio'
import { miscUiState } from '../globalState'
import {
  isRemoteSplashText,
  loadRemoteSplashText,
  getCachedSplashText,
  cacheSplashText,
  cacheSourceUrl,
  clearSplashCache
} from '../utils/splashText'
import styles from './mainMenu.module.css'
import ButtonWithTooltip from './ButtonWithTooltip'
import useLongPress from './useLongPress'
import { withInjectableUi } from './extendableSystem'

type Action = (e: React.MouseEvent<HTMLButtonElement>) => void

interface Props {
  connectToServerAction?: Action
  singleplayerAction?: Action
  optionsAction?: Action
  githubAction?: Action
  openFileAction?: Action
  mapsProvider?: string
  versionStatus?: string
  versionTitle?: string
  onVersionStatusClick?: () => void
  bottomRightLinks?: string
  versionText?: string
  onVersionTextClick?: () => void
  singleplayerAvailable?: boolean
}

const MainMenuBase = ({
  singleplayerAction,
  versionText,
  onVersionTextClick,
  versionStatus,
  versionTitle,
  onVersionStatusClick,
  bottomRightLinks,
  singleplayerAvailable = true,
}: Props) => {
  const { appConfig } = useSnapshot(miscUiState)

  const splashText = useMemo(() => {
    const cachedText = getCachedSplashText()

    const configSplashFromApp = appConfig?.splashText
    const isRemote = configSplashFromApp && isRemoteSplashText(configSplashFromApp)
    const sourceKey = isRemote ? configSplashFromApp : (configSplashFromApp || '')
    const storedSourceKey = localStorage.getItem('minecraft_splash_url')

    if (storedSourceKey !== sourceKey) {
      clearSplashCache()
      cacheSourceUrl(sourceKey)
    } else if (cachedText) {
      return cachedText
    }

    if (!isRemote && configSplashFromApp && configSplashFromApp.trim() !== '') {
      cacheSplashText(configSplashFromApp)
      return configSplashFromApp
    }

    return appConfig?.splashTextFallback || ''
  }, [])

  useEffect(() => {
    const configSplashFromApp = appConfig?.splashText
    if (configSplashFromApp && isRemoteSplashText(configSplashFromApp)) {
      loadRemoteSplashText(configSplashFromApp)
        .then(fetchedText => {
          if (fetchedText && fetchedText.trim() !== '' && !fetchedText.includes('Failed to load')) {
            cacheSplashText(fetchedText)
          }
        })
        .catch(error => {
          console.error('Failed to preload splash text for next session:', error)
        })
    }
  }, [appConfig?.splashText])

  if (!bottomRightLinks?.trim()) bottomRightLinks = undefined
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const linksParsed = bottomRightLinks?.split(/;|\n/g).map(l => {
    const parts = l.split(':')
    return [parts[0], parts.slice(1).join(':')]
  }) as Array<[string, string]> | undefined

  const singleplayerLongPress = useLongPress(
    () => {
      window.location.href = window.location.pathname + '?sp=1'
    },
    () => singleplayerAction?.(null as any),
    { delay: 500 }
  )

  const versionLongPress = useLongPress(
    () => {
      const buildDate = process.env.BUILD_VERSION ? new Date(process.env.BUILD_VERSION + ':00:00.000Z') : null
      const hoursAgo = buildDate ? Math.round((Date.now() - buildDate.getTime()) / (1000 * 60 * 60)) : null
      alert(`BUILD DATE:\n${buildDate?.toLocaleString() || 'Development build'}${hoursAgo ? `\nBuilt ${hoursAgo} hours ago` : ''}`)
    },
    () => onVersionTextClick?.(),
  )

  return (
    <div className={styles.root}>
      <div className={styles['game-title']}>
        <div className={styles.minecraft}>
          <div className={styles.edition} />
          <span className={styles.splash}>{splashText}</span>
        </div>
      </div>

      <div className={styles.menu}>
        <ButtonWithTooltip
          {...singleplayerLongPress}
          data-test-id='singleplayer-button'
          disabled={!singleplayerAvailable}
          initialTooltip={{
            content: 'Create worlds and play offline',
            placement: 'top',
          }}
        >
          Singleplayer
        </ButtonWithTooltip>
      </div>

      <div className={styles['bottom-info']}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: 'gray' }} {...versionLongPress}>{versionText}</span>
          <span
            title={`${versionTitle} (click to reload)`}
            onClick={onVersionStatusClick}
            className={styles['product-info']}
          >
            <span style={{
              position: 'absolute',
              left: '-9999px',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
              clip: 'rect(1px, 1px, 1px, 1px)',
              whiteSpace: 'nowrap'
            }}>
              Prismarine Web Client
            </span>

            V2 Presented by Sandexzx {versionStatus}
          </span>
        </div>
        <span className={styles['product-description']}>
          <div className={styles['product-link']}>
            {linksParsed?.map(([name, link], i, arr) => {
              if (!link.startsWith('http')) link = `https://${link}`
              const finalLink = link
              return <div key={name} style={{
                color: 'lightgray',
                fontSize: 8,
              }}>
                <a
                  style={{
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    window.open(finalLink, '_blank', 'noopener,noreferrer')
                  }}
                >{name}
                </a>
                {i < arr.length - 1 && <span style={{ marginLeft: 2 }}>·</span>}
              </div>
            })}
          </div>
          <span>{appConfig?.rightSideText}</span>
        </span>
      </div>
    </div>
  )
}

export default withInjectableUi(MainMenuBase, 'mainMenu')
