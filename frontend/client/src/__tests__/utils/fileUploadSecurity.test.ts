/**
 * Unit Tests for File Upload Security
 * Tests file validation, security scanning, and error handling
 */

import { fileUploadSecurity, validateFile, validateFiles } from '@/utils/fileUploadSecurity';

describe('File Upload Security', () => {
  // Mock file for testing
  const createMockFile = (name: string, type: string, size: number): File => {
    const file = new File(['test content ', ], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
};

  describe('validateFile', () => {
    it('should validate a valid image file', async () => {
      const file = createMockFile('test.jpg','image/jpeg', 1024 * 1024); // 1MB
      
      const result = await validateFile(file);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.fileInfo.name).toBe('test.jpg');
      expect(result.fileInfo.type).toBe('image/jpeg');
      expect(result.fileInfo.isImage).toBe(true);
  });

    it('should reject file that is too large', async () => {
      const file = createMockFile('large.jpg','image/jpeg', 200 * 1024 * 1024); // 200MB
      
      const result = await validateFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('File size'));
  });

    it('should reject unsupported file type', async () => {
      const file = createMockFile('test.exe','application/x-executable', 1024);
      
      const result = await validateFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('not allowed'));
  });

    it('should reject blocked file type', async () => {
      const file = createMockFile('malware.exe','application/x-msdownload', 1024);
      
      const result = await validateFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('blocked'));
  });

    it('should validate video file with duration check', async () => {
      const file = createMockFile('short.mp4','video/mp4', 5 * 1024 * 1024);
      
      const result = await validateFile(file);
      
      expect(result.fileInfo.isVideo).toBe(true);
      expect(result.fileInfo.duration).toBeDefined();
  });

    it('should validate audio file with metadata', async () => {
      const file = createMockFile('music.mp3','audio/mp3', 2 * 1024 * 1024);
      
      const result = await validateFile(file);
      
      expect(result.fileInfo.isAudio).toBe(true);
      expect(result.fileInfo.bitrate).toBeDefined();
      expect(result.fileInfo.sampleRate).toBeDefined();
  });

    it('should calculate security score correctly', async () => {
      const file = createMockFile('safe.jpg','image/jpeg', 1024);
      
      const result = await validateFile(file);
      
      expect(result.securityScore).toBeGreaterThan(0);
      expect(result.securityScore).toBeLessThanOrEqual(100);
  });

    it('should provide recommendations for optimization', async () => {
      const file = createMockFile('large.jpg','image/jpeg', 80 * 1024 * 1024); // 80MB
      
      const result = await validateFile(file);
      
      expect(result.recommendations).toContain(expect.stringContaining('compressing'));
  });
});

  describe('validateFiles', () => {
    it('should validate multiple files', async () => {
      const files = [
        createMockFile('test1.jpg','image/jpeg', 1024),
        createMockFile('test2.png','image/png', 2048)
      ];
      
      const results = await validateFiles(files);
      
      expect(results).toHaveLength(2);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
  });

    it('should reject when too many files', async () => {
      const files = Array(15).fill(null).map((_, i) => 
        createMockFile(`test${i}.jpg`, 'image/jpeg', 1024)
      );
      
      await expect(validateFiles(files)).rejects.toThrow('Too many files');
  });
});

  describe('File type detection', () => {
    it('should correctly identify image types', () => {
      const imageTypes = ['image/jpeg','image/png','image/gif','image/webp'];
      
      imageTypes.forEach(type => {
        const file = createMockFile('test', type, 1024);
        expect(fileUploadSecurity['isImageType'](type)).toBe(true);
    });
  });

    it('should correctly identify video types', () => {
      const videoTypes = ['video/mp4','video/webm','video/ogg'];
      
      videoTypes.forEach(type => {
        const file = createMockFile('test', type, 1024);
        expect(fileUploadSecurity['isVideoType'](type)).toBe(true);
    });
  });

    it('should correctly identify audio types', () => {
      const audioTypes = ['audio/mp3','audio/wav','audio/ogg'];
      
      audioTypes.forEach(type => {
        const file = createMockFile('test', type, 1024);
        expect(fileUploadSecurity['isAudioType'](type)).toBe(true);
    });
  });

    it('should correctly identify executable types', () => {
      const executableTypes = ['application/x-executable','application/x-msdownload'];
      
      executableTypes.forEach(type => {
        expect(fileUploadSecurity['isExecutableType'](type)).toBe(true);
    });
  });
});

  describe('Security scanning', () => {
    it('should detect suspicious filenames', async () => {
      const file = createMockFile('virus.exe','application/x-executable', 1024);
      
      const result = await validateFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Virus detected'));
  });

    it('should quarantine suspicious files', async () => {
      const file = createMockFile('suspicious.exe','application/x-executable', 1024);
      
      const quarantineSpy = jest.spyOn(fileUploadSecurity, 'quarantineFile');
      
      await validateFile(file);
      
      expect(quarantineSpy).toHaveBeenCalled();
  });
});

  describe('Configuration', () => {
    it('should allow custom configuration', () => {
      const customConfig = {
        maxFileSize: 50 * 1024 * 14, // 50MB
        allowedTypes: ['image/jpeg']
  };
      
      fileUploadSecurity.updateConfig(customConfig);
      const config = fileUploadSecurity.getConfig();
      
      expect(config.maxFileSize).toBe(50 * 1024 * 1024);
      expect(config.allowedTypes).toEqual(['image/jpeg']);
  });

    it('should merge configuration with defaults', () => {
      const customConfig = {
        maxFileSize: 25 * 1024 * 1024 // 25MB
  };
      
      fileUploadSecurity.updateConfig(customConfig);
      const config = fileUploadSecurity.getConfig();
      
      expect(config.maxFileSize).toBe(25 * 1024 * 1024);
      expect(config.allowedTypes).toBeDefined();
      expect(config.blockedTypes).toBeDefined();
  });
});

  describe('Error handling', () => {
    it('should handle file reading errors gracefully', async () => {
      const file = createMockFile('corrupt.jpg','image/jpeg', 1024);
      
      // Mock file reading to throw error
      jest.spyOn(File.prototype, 'arrayBuffer').mockRejectedValue(new Error('Read error'));
      
      const result = await validateFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Failed to validate'));
  });

    it('should handle network errors during virus scanning', async () => {
      const file = createMockFile('test.jpg','image/jpeg', 1024);
      
      // Mock virus scanning to throw error
      jest.spyOn(fileUploadSecurity, 'scanForVirus').mockRejectedValue(new Error('Network error'));
      
      const result = await validateFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Virus scanning failed'));
  });
});

  describe('Performance', () => {
    it('should validate files within reasonable time', async () => {
      const file = createMockFile('test.jpg','image/jpeg', 1024);
      
      const startTime = performance.now();
      await validateFile(file);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
  });

    it('should handle large files efficiently', async () => {
      const file = createMockFile('large.jpg','image/jpeg', 10 * 1024 * 1024); // 10MB
      
      const startTime = performance.now();
      await validateFile(file);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
  });
});

  describe('Edge cases', () => {
    it('should handle empty file', async () => {
      const file = createMockFile('empty.txt','text/plain', 0);
      
      const result = await validateFile(file);
      
      expect(result.isValid).toBe(true);
      expect(result.fileInfo.size).toBe(0);
  });

    it('should handle file with no extension', async () => {
      const file = createMockFile('noextension','image/jpeg', 1024);
      
      const result = await validateFile(file);
      
      expect(result.fileInfo.extension).toBe(', ');
  });

    it('should handle file with multiple extensions', async () => {
      const file = createMockFile('test.tar.gz', 'application/gzip', 1024);
      
      const result = await validateFile(file);
      
      expect(result.fileInfo.extension).toBe('.gz');
  });

    it('should handle file with special characters in name', async () => {
      const file = createMockFile('test file (1).jpg', 'image/jpeg', 1024);
      
      const result = await validateFile(file);
      
      expect(result.isValid).toBe(true);
      expect(result.fileInfo.name).toBe('test file (1).jpg');
  });
});
});





