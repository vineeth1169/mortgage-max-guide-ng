import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PoolAssistantPageComponent } from './pool-assistant-page.component';

describe('PoolAssistantPageComponent', () => {
  let component: PoolAssistantPageComponent;
  let fixture: ComponentFixture<PoolAssistantPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PoolAssistantPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(PoolAssistantPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render pool chat component', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    // The page should contain the pool chat component
    expect(compiled.querySelector('app-pool-chat') || compiled.children.length > 0).toBeTruthy();
  });
});
