/**
 * 安全存储工具
 * 使用 electron-safe-storage 加密敏感信息
 */

import { safeStorage, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

interface SecureStoreData {
  [key: string]: string // 加密后的 base64 字符串
}

class SecureStorage {
  private filePath: string
  private data: SecureStoreData = {}

  constructor() {
    // 存储在用户数据目录下
    const userDataPath = app.getPath('userData')
    this.filePath = path.join(userDataPath, 'secure-store.json')
    this.load()
  }

  /**
   * 从文件加载加密数据
   */
  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8')
        this.data = JSON.parse(content)
      }
    } catch (error) {
      console.error('Failed to load secure store:', error)
      this.data = {}
    }
  }

  /**
   * 保存加密数据到文件
   */
  private save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to save secure store:', error)
    }
  }

  /**
   * 检查是否支持安全存储
   */
  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  /**
   * 加密字符串
   */
  private encrypt(plainText: string): string {
    if (!this.isAvailable()) {
      console.warn('Safe storage not available, storing as plain text')
      return Buffer.from(plainText).toString('base64')
    }

    try {
      const encrypted = safeStorage.encryptString(plainText)
      return encrypted.toString('base64')
    } catch (error) {
      console.error('Encryption failed:', error)
      throw new Error('Failed to encrypt data')
    }
  }

  /**
   * 解密字符串
   */
  private decrypt(encryptedBase64: string): string {
    if (!this.isAvailable()) {
      console.warn('Safe storage not available, decoding as plain text')
      return Buffer.from(encryptedBase64, 'base64').toString('utf-8')
    }

    try {
      const encrypted = Buffer.from(encryptedBase64, 'base64')
      return safeStorage.decryptString(encrypted)
    } catch (error) {
      console.error('Decryption failed:', error)
      throw new Error('Failed to decrypt data')
    }
  }

  /**
   * 设置加密值
   */
  set(key: string, value: string): void {
    if (!value) return
    
    const encrypted = this.encrypt(value)
    this.data[key] = encrypted
    this.save()
  }

  /**
   * 获取解密值
   */
  get(key: string): string | null {
    const encrypted = this.data[key]
    if (!encrypted) return null

    try {
      return this.decrypt(encrypted)
    } catch (error) {
      console.error(`Failed to get key ${key}:`, error)
      return null
    }
  }

  /**
   * 删除值
   */
  delete(key: string): void {
    delete this.data[key]
    this.save()
  }

  /**
   * 检查是否存在
   */
  has(key: string): boolean {
    return key in this.data
  }

  /**
   * 获取所有键
   */
  keys(): string[] {
    return Object.keys(this.data)
  }

  /**
   * 清除所有数据
   */
  clear(): void {
    this.data = {}
    this.save()
  }
}

// 单例实例
let secureStorageInstance: SecureStorage | null = null

export function getSecureStorage(): SecureStorage {
  if (!secureStorageInstance) {
    secureStorageInstance = new SecureStorage()
  }
  return secureStorageInstance
}

export { SecureStorage }
