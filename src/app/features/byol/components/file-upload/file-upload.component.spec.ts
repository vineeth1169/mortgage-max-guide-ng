import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileUploadComponent } from './file-upload.component';

describe('FileUploadComponent', () => {
  let component: FileUploadComponent;
  let fixture: ComponentFixture<FileUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileUploadComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FileUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with no selected file', () => {
    expect(component.selectedFile()).toBeNull();
  });

  it('should start with no error', () => {
    expect(component.error()).toBe('');
  });

  it('should start with dragOver as false', () => {
    expect(component.dragOver()).toBe(false);
  });

  describe('drag and drop', () => {
    it('should set dragOver to true on dragOver event', () => {
      const event = new DragEvent('dragover');
      component.onDragOver(event);
      expect(component.dragOver()).toBe(true);
    });

    it('should set dragOver to false on dragLeave event', () => {
      component.dragOver.set(true);
      const event = new DragEvent('dragleave');
      component.onDragLeave(event);
      expect(component.dragOver()).toBe(false);
    });
  });

  describe('clearFile', () => {
    it('should clear selected file and error', () => {
      component.selectedFile.set(new File(['test'], 'test.csv'));
      component.error.set('Some error');

      const event = new Event('click');
      spyOn(event, 'stopPropagation');

      component.clearFile(event);

      expect(component.selectedFile()).toBeNull();
      expect(component.error()).toBe('');
      expect(event.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('file validation', () => {
    it('should render the upload dropzone', () => {
      const nativeElement = fixture.nativeElement;
      const dropzone = nativeElement.querySelector('.upload-dropzone');
      expect(dropzone).toBeTruthy();
    });

    it('should show upload placeholder initially', () => {
      const nativeElement = fixture.nativeElement;
      const placeholder = nativeElement.querySelector('.upload-placeholder');
      expect(placeholder).toBeTruthy();
    });
  });
});
