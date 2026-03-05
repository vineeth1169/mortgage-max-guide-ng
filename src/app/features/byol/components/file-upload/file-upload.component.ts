import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileParserService } from '../../services/file-parser.service';

/**
 * FileUploadComponent - Drag-and-drop / click-to-browse file uploader
 */
@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="byol-upload-card p-6 bg-white rounded-lg border border-gray-200">
      <div
        class="upload-dropzone border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer transition"
        [class.border-blue-500]="dragOver()"
        [class.bg-blue-50]="dragOver()"
        [class.opacity-50]="loading()"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
        (click)="!loading() && fileInput.click()"
      >
        <input
          #fileInput
          type="file"
          [accept]="fileParserService.getAcceptString()"
          (change)="onFileInputChange($event)"
          hidden
        />

        @if (loading()) {
          <div class="upload-loading">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p class="text-gray-600">Parsing file…</p>
          </div>
        } @else if (selectedFile()) {
          <div class="upload-selected flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="text-4xl text-gray-400">📄</div>
              <div class="text-left">
                <p class="upload-filename font-semibold text-gray-900">{{ selectedFile()?.name }}</p>
                <p class="upload-filesize text-sm text-gray-500">
                  {{ (selectedFile()!.size / 1024).toFixed(1) }} KB
                </p>
              </div>
            </div>
            <button
              class="btn-icon text-gray-400 hover:text-red-600 transition"
              title="Clear file"
              (click)="clearFile($event)"
            >
              ✕
            </button>
          </div>
        } @else {
          <div class="upload-placeholder">
            <div class="text-5xl mb-4">📤</div>
            <p class="upload-main-text font-semibold text-gray-900 mb-2">
              Drag &amp; drop your loan file here
            </p>
            <p class="upload-sub-text text-gray-500">
              or <span class="text-blue-600 font-semibold">browse</span> to select
            </p>
            <p class="text-xs text-gray-400 mt-4">
              Accepted formats: CSV, XLSX, XLS, TSV, TXT
            </p>
          </div>
        }
      </div>

      @if (error()) {
        <div class="error-message text-red-600 text-sm mt-4 p-3 bg-red-50 rounded">
          ⚠️ {{ error() }}
        </div>
      }
    </div>
  `,
  styles: [],
})
export class FileUploadComponent {
  readonly fileParserService = new FileParserService();

  readonly loading = input(false);
  readonly onFileSelected = output<File>();

  readonly dragOver = signal(false);
  readonly selectedFile = signal<File | null>(null);
  readonly error = signal('');

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  private handleFile(file: File): void {
    this.error.set('');

    if (!this.fileParserService.isAcceptedFile(file.name)) {
      this.error.set('Unsupported file type. Accepted: .csv, .xlsx, .xls, .tsv, .txt');
      return;
    }

    this.selectedFile.set(file);
    this.onFileSelected.emit(file);
  }

  clearFile(event: Event): void {
    event.stopPropagation();
    this.selectedFile.set(null);
    this.error.set('');
  }
}
