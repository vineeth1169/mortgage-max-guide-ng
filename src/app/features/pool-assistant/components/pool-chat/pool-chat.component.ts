import { Component, inject, signal, computed, viewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PoolLogicChatService } from '../../services/pool-logic-chat.service';

@Component({
  selector: 'app-pool-chat',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="flex flex-col h-full">

      <!-- ===== Session Tabs ===== -->
      <div class="flex items-center gap-1 px-2 py-2 bg-gray-100 border-b border-gray-200 overflow-x-auto">
        @for (session of chatService.sessions(); track session.id) {
          <div
            class="flex items-center gap-1 px-3 py-1.5 rounded-t-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap group"
            [class]="session.id === chatService.activeSessionId()
              ? 'bg-white text-fm-blue border-t border-l border-r border-gray-200 -mb-px'
              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'"
            (click)="chatService.switchSession(session.id)"
          >
            @if (editingSessionId() === session.id) {
              <input
                #sessionNameInput
                type="text"
                class="w-24 px-1 py-0.5 text-xs rounded border border-fm-blue focus:outline-none"
                [value]="session.name"
                (blur)="finishEditSessionName(session.id, $event)"
                (keydown.enter)="finishEditSessionName(session.id, $event)"
                (keydown.escape)="cancelEditSessionName()"
                (click)="$event.stopPropagation()"
              />
            } @else {
              <span (dblclick)="startEditSessionName(session.id, $event)">{{ session.name }}</span>
            }
            <button
              class="ml-1 w-4 h-4 flex items-center justify-center rounded hover:bg-red-100 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
              [class.cursor-not-allowed]="chatService.sessions().length <= 1"
              [class.hover:bg-red-100]="chatService.sessions().length > 1"
              (click)="chatService.sessions().length > 1 ? deleteSession(session.id, $event) : createNewSession(); $event.stopPropagation()"
              [title]="chatService.sessions().length > 1 ? 'Close session' : 'Clear and start new (cannot delete only session)'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        }
        <button
          class="flex items-center justify-center w-7 h-7 rounded-lg text-gray-500 hover:bg-white hover:text-fm-blue transition-colors"
          (click)="createNewSession()"
          title="New session"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      <!-- ===== Chat Messages ===== -->
      <div
        #scrollContainer
        class="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gradient-to-b from-gray-50 to-white"
      >
        @for (msg of chatService.messages(); track msg.id) {
          <div
            class="flex gap-3 animate-fadeIn"
            [class.justify-end]="msg.role === 'user'"
          >
            <!-- Avatar -->
            @if (msg.role === 'assistant') {
              <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-fm-blue flex items-center justify-center mt-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 8V4H8"/>
                  <rect width="16" height="12" x="4" y="8" rx="2"/>
                  <path d="M2 14h2"/>
                  <path d="M20 14h2"/>
                  <path d="M15 13v2"/>
                  <path d="M9 13v2"/>
                </svg>
              </div>
            }

            <!-- Message Bubble -->
            <div
              class="max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed shadow-sm"
              [class]="msg.role === 'user'
                ? 'bg-fm-blue text-white rounded-br-sm'
                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'"
            >
              <!-- Attachments -->
              @if (msg.attachments?.length) {
                @for (att of msg.attachments; track att.name) {
                  <div class="flex items-center gap-2 mb-2 p-2 rounded-lg"
                       [class]="att.status === 'parsed' ? 'bg-green-50 border border-green-200' :
                                att.status === 'error' ? 'bg-red-50 border border-red-200' :
                                'bg-blue-50 border border-blue-200'">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 flex-shrink-0"
                         [class]="att.status === 'parsed' ? 'text-green-600' :
                                  att.status === 'error' ? 'text-red-600' : 'text-blue-600'"
                         viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                         stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <div class="flex-1 min-w-0">
                      <span class="text-xs font-medium truncate block"
                            [class]="msg.role === 'user' ? 'text-blue-100' : 'text-gray-700'">{{ att.name }}</span>
                      @if (att.loanCount) {
                        <span class="text-xs text-green-600">{{ att.loanCount }} loans parsed</span>
                      }
                      @if (att.errorMessage) {
                        <span class="text-xs text-red-600">{{ att.errorMessage }}</span>
                      }
                    </div>
                  </div>
                }
              }

              <!-- Message Content (rendered as markdown-ish) -->
              <div class="message-content whitespace-normal" [innerHTML]="renderMarkdown(msg.content)"></div>
            </div>

            <!-- User Avatar -->
            @if (msg.role === 'user') {
              <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-600 flex items-center justify-center mt-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
            }
          </div>
        }

        <!-- Agent Status Indicator -->
        @if (chatService.isProcessing()) {
          <div class="flex gap-3 animate-fadeIn">
            <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-fm-blue flex items-center justify-center mt-1 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 8V4H8"/>
                <rect width="16" height="12" x="4" y="8" rx="2"/>
                <path d="M2 14h2"/>
                <path d="M20 14h2"/>
                <path d="M15 13v2"/>
                <path d="M9 13v2"/>
              </svg>
            </div>
            <div class="bg-white border border-gray-200 rounded-xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div class="flex items-center gap-3">
                <div class="flex gap-1">
                  <span class="w-2 h-2 bg-fm-blue rounded-full animate-bounce" style="animation-delay: 0ms"></span>
                  <span class="w-2 h-2 bg-fm-blue rounded-full animate-bounce" style="animation-delay: 150ms"></span>
                  <span class="w-2 h-2 bg-fm-blue rounded-full animate-bounce" style="animation-delay: 300ms"></span>
                </div>
                <span class="text-xs text-gray-500">{{ chatService.agentStatus().currentStep }}</span>
              </div>
              @if (chatService.agentStatus().progress > 0) {
                <div class="mt-2 w-48 bg-gray-200 rounded-full h-1.5">
                  <div class="bg-fm-blue h-1.5 rounded-full transition-all duration-300"
                       [style.width.%]="chatService.agentStatus().progress"></div>
                </div>
              }
            </div>
          </div>
        }
      </div>

      <!-- ===== File Drop Zone ===== -->
      <div
        class="mx-4 mb-2"
        (dragover)="onDragOver($event)"
        (dragleave)="isDragging.set(false)"
        (drop)="onDrop($event)"
      >
        @if (isDragging()) {
          <div class="border-2 border-dashed border-fm-blue bg-blue-50 rounded-xl p-6 text-center transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 mx-auto text-fm-blue mb-2" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p class="text-sm font-medium text-fm-blue">Drop your loan file here</p>
            <p class="text-xs text-gray-500 mt-1">CSV or JSON files</p>
          </div>
        }
      </div>

      <!-- ===== Quick Actions (when no loans loaded) ===== -->
      @if (chatService.uploadedLoans().length === 0) {
        <div class="px-4 mb-3">
          <div class="flex flex-wrap gap-2">
            <button
              (click)="onQuickAction('load sample')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full
                     border border-fm-blue/30 text-fm-blue bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Load Sample Data
            </button>
            <button
              (click)="fileInput.click()"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full
                     border border-fm-green/30 text-fm-green bg-green-50 hover:bg-green-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Upload Loan File
            </button>
            <button
              (click)="onQuickAction('show rules')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full
                     border border-gray-300 text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              View Rules
            </button>
            <button
              (click)="onQuickAction('help')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full
                     border border-gray-300 text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Help
            </button>
          </div>
        </div>
      } @else {
        <!-- Quick Actions when loans are loaded -->
        <div class="px-4 mb-3">
          <div class="flex flex-wrap gap-2">
            <button
              (click)="onQuickAction('validate')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full
                     border border-fm-blue/30 text-fm-blue bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              Validate Loans
            </button>
            <button
              (click)="onQuickAction('build pool')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full
                     border border-fm-green/30 text-fm-green bg-green-50 hover:bg-green-100 transition-colors"
            >
              Build Pool
            </button>
            <button
              (click)="onQuickAction('show ineligible')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full
                     border border-fm-orange/30 text-fm-orange bg-orange-50 hover:bg-orange-100 transition-colors"
            >
              Show Ineligible
            </button>
            <button
              (click)="onQuickAction('summary')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full
                     border border-gray-300 text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              Summary
            </button>
          </div>
        </div>
      }

      <!-- ===== Input Area ===== -->
      <div class="border-t border-gray-200 bg-white px-4 py-3">
        <div class="flex items-end gap-2">
          <!-- File Upload Button -->
          <button
            (click)="fileInput.click()"
            class="flex-shrink-0 w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center
                   text-gray-500 hover:text-fm-blue hover:border-fm-blue hover:bg-blue-50 transition-colors"
            title="Upload loan file"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <input
            #fileInput
            type="file"
            accept=".csv,.json,.xlsx,.xls"
            class="hidden"
            (change)="onFileSelected($event)"
          />

          <!-- Text Input -->
          <div class="flex-1 relative">
            <textarea
              [(ngModel)]="inputText"
              (keydown)="onKeyDown($event)"
              (input)="onInputChange()"
              (focus)="onInputChange()"
              (blur)="hideSuggestionsDelayed()"
              placeholder="Ask about loans, rules, or type a command..."
              rows="1"
              class="w-full resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm
                     focus:border-fm-blue focus:outline-none focus:ring-2 focus:ring-fm-blue/20
                     transition-all placeholder-gray-400"
              [disabled]="chatService.isProcessing()"
            ></textarea>

            <!-- Suggestions Dropdown -->
            @if (filteredSuggestions().length > 0 && showSuggestions()) {
              <div class="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                @for (s of filteredSuggestions(); track s.command; let i = $index) {
                  <button
                    (mousedown)="selectSuggestion(s.command)"
                    class="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center gap-2 border-b border-gray-100 last:border-0"
                    [class.bg-blue-50]="i === selectedSuggestionIndex()"
                  >
                    <span class="text-fm-blue font-medium flex-shrink-0">{{ s.command }}</span>
                    <span class="text-gray-400 text-xs truncate">{{ s.description }}</span>
                  </button>
                }
              </div>
            }
          </div>

          <!-- Send Button -->
          <button
            (click)="sendMessage()"
            [disabled]="!inputText().trim() || chatService.isProcessing()"
            class="flex-shrink-0 w-10 h-10 rounded-lg bg-fm-blue text-white flex items-center justify-center
                   hover:bg-[#0088cc] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>

        <div class="flex items-center justify-between mt-2">
          <div class="flex items-center gap-3">
            <span class="text-[10px] text-gray-400">
              Loan Pool Advisor does not modify loan data. Analysis only.
            </span>

            <!-- AI Provider Selector -->
            <div class="flex items-center gap-1.5">
              <!-- Provider Dropdown -->
              <div class="relative">
                <button
                  (click)="showProviderMenu.set(!showProviderMenu())"
                  class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border"
                  [class]="getProviderButtonClass()"
                >
                  <span class="text-sm">{{ chatService.aiProviderInfo().icon }}</span>
                  {{ chatService.aiProviderInfo().name }}
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 ml-0.5" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                <!-- Dropdown Menu -->
                @if (showProviderMenu()) {
                  <div class="absolute bottom-full left-0 mb-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <button
                      (click)="selectProvider('groq')"
                      class="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 transition-colors"
                      [class.bg-blue-50]="chatService.aiProvider() === 'groq'"
                    >
                      <span class="text-base">⚡</span>
                      <div class="flex-1">
                        <div class="font-medium text-gray-800">Groq</div>
                        <div class="text-[10px] text-gray-500">Free, ultra-fast LLaMA 3.1</div>
                      </div>
                      @if (chatService.aiProvider() === 'groq') {
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      }
                    </button>
                    <button
                      (click)="selectProvider('claude')"
                      class="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 transition-colors"
                      [class.bg-blue-50]="chatService.aiProvider() === 'claude'"
                    >
                      <span class="text-base">🧠</span>
                      <div class="flex-1">
                        <div class="font-medium text-gray-800">Claude</div>
                        <div class="text-[10px] text-gray-500">Anthropic Sonnet (paid)</div>
                      </div>
                      @if (chatService.aiProvider() === 'claude') {
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      }
                    </button>
                    <button
                      (click)="selectProvider('demo')"
                      class="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 transition-colors"
                      [class.bg-blue-50]="chatService.aiProvider() === 'demo'"
                    >
                      <span class="text-base">🎯</span>
                      <div class="flex-1">
                        <div class="font-medium text-gray-800">Demo</div>
                        <div class="text-[10px] text-gray-500">Offline pattern matching</div>
                      </div>
                      @if (chatService.aiProvider() === 'demo') {
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      }
                    </button>
                  </div>
                }
              </div>

              <!-- API Key button (when not configured) -->
              @if (chatService.aiProvider() !== 'demo' && !chatService.aiConfigured()) {
                <button
                  (click)="showApiKeyInput.set(!showApiKeyInput())"
                  class="text-[10px] text-orange-600 hover:text-orange-800 font-medium"
                >
                  Set API Key
                </button>
              }
            </div>
          </div>

          <button
            (click)="chatService.clearChat()"
            class="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
          >
            Clear conversation
          </button>
        </div>

        <!-- API Key Input (shown when needed) -->
        @if (showApiKeyInput()) {
          <div class="mt-2 flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
            <input
              type="password"
              [(ngModel)]="apiKeyInput"
              [placeholder]="chatService.aiProvider() === 'groq' ? 'Enter Groq API key (free at console.groq.com)...' : 'Enter Claude API key...'"
              class="flex-1 text-xs px-2 py-1.5 rounded border border-blue-300 focus:outline-none focus:border-blue-500"
            />
            <button
              (click)="saveApiKey()"
              class="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
            <button
              (click)="showApiKeyInput.set(false)"
              class="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fadeIn {
      animation: fadeIn 0.3s ease-out;
    }

    .message-content :deep(h2) {
      font-size: 1rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: #333;
    }
    .message-content :deep(h3) {
      font-size: 0.875rem;
      font-weight: 600;
      margin-top: 0.75rem;
      margin-bottom: 0.25rem;
      color: #444;
    }
    .message-content :deep(table) {
      width: 100%;
      border-collapse: collapse;
      margin: 0.5rem 0;
      font-size: 0.75rem;
    }
    .message-content :deep(th) {
      background-color: #f3f4f6;
      padding: 0.35rem 0.5rem;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #d1d5db;
      white-space: nowrap;
    }
    .message-content :deep(td) {
      padding: 0.3rem 0.5rem;
      border-bottom: 1px solid #e5e7eb;
    }
    .message-content :deep(tr:hover) td {
      background-color: #f9fafb;
    }
    .message-content :deep(blockquote) {
      border-left: 3px solid #009BE4;
      padding: 0.5rem 0.75rem;
      margin: 0.5rem 0;
      background-color: #eff6ff;
      border-radius: 0 0.375rem 0.375rem 0;
      font-size: 0.8125rem;
    }
    .message-content :deep(strong) {
      font-weight: 600;
    }
    .message-content :deep(ul), .message-content :deep(ol) {
      padding-left: 1.25rem;
      margin: 0.25rem 0;
    }
    .message-content :deep(li) {
      margin-bottom: 0.15rem;
    }
    .message-content :deep(code) {
      background-color: #f3f4f6;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-size: 0.8em;
    }

    textarea {
      max-height: 120px;
      min-height: 40px;
    }
  `],
})
export class PoolChatComponent implements AfterViewChecked {
  readonly chatService = inject(PoolLogicChatService);
  readonly scrollContainer = viewChild<ElementRef>('scrollContainer');

  readonly inputText = signal('');
  readonly isDragging = signal(false);
  readonly showSuggestions = signal(false);
  readonly selectedSuggestionIndex = signal(-1);
  readonly editingSessionId = signal<string | null>(null);
  readonly showApiKeyInput = signal(false);
  readonly apiKeyInput = signal('');
  readonly showProviderMenu = signal(false);

  private shouldScrollToBottom = true;
  private hideTimeout: any;

  private readonly allSuggestions: { command: string; description: string; requiresLoans: boolean }[] = [
    { command: 'validate', description: 'Run eligibility checks on all loaded loans', requiresLoans: true },
    { command: 'build pool', description: 'Construct a pool with eligible loans', requiresLoans: true },
    { command: 'show ineligible', description: 'View detailed failure reasons for ineligible loans', requiresLoans: true },
    { command: 'show rules', description: 'List all PoolLogic eligibility rules', requiresLoans: false },
    { command: 'summary', description: 'Show pool and validation summary', requiresLoans: true },
    { command: 'show sample', description: 'Preview the parsed loan data', requiresLoans: true },
    { command: 'load sample', description: 'Load demonstration loan data', requiresLoans: false },
    { command: 'help', description: 'Show available commands and usage', requiresLoans: false },
    { command: 'filter loans by status A', description: 'Filter loans by active status', requiresLoans: true },
    { command: 'filter loans by property SF', description: 'Filter by single-family properties', requiresLoans: true },
    { command: 'filter coupon above 4', description: 'Filter by minimum coupon rate', requiresLoans: true },
    { command: 'explain rule RATE-001', description: 'Explain the Positive Interest Rate rule', requiresLoans: false },
    { command: 'explain rule BAL-003', description: 'Explain the Conforming Loan Limit rule', requiresLoans: false },
    { command: 'explain rule PROP-001', description: 'Explain the Eligible Property Types rule', requiresLoans: false },
  ];

  readonly filteredSuggestions = computed(() => {
    const text = this.inputText().toLowerCase().trim();
    if (!text) return [];
    const hasLoans = this.chatService.uploadedLoans().length > 0;
    return this.allSuggestions
      .filter(s => {
        if (s.requiresLoans && !hasLoans) return false;
        return s.command.toLowerCase().includes(text) || s.description.toLowerCase().includes(text);
      })
      .slice(0, 6);
  });

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  sendMessage(): void {
    const text = this.inputText().trim();
    if (!text) return;
    this.inputText.set('');
    this.shouldScrollToBottom = true;
    this.chatService.sendMessage(text);
  }

  onQuickAction(action: string): void {
    this.shouldScrollToBottom = true;
    this.chatService.sendMessage(action);
  }

  onKeyDown(event: KeyboardEvent): void {
    const suggestions = this.filteredSuggestions();

    if (this.showSuggestions() && suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.selectedSuggestionIndex.update(i => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.selectedSuggestionIndex.update(i => Math.max(i - 1, 0));
        return;
      }
      if (event.key === 'Tab' || (event.key === 'Enter' && this.selectedSuggestionIndex() >= 0)) {
        event.preventDefault();
        const idx = this.selectedSuggestionIndex();
        if (idx >= 0 && idx < suggestions.length) {
          this.selectSuggestion(suggestions[idx].command);
        }
        return;
      }
      if (event.key === 'Escape') {
        this.showSuggestions.set(false);
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onInputChange(): void {
    const text = this.inputText().trim();
    if (text.length > 0) {
      this.showSuggestions.set(true);
      this.selectedSuggestionIndex.set(-1);
    } else {
      this.showSuggestions.set(false);
    }
  }

  selectSuggestion(command: string): void {
    this.inputText.set(command);
    this.showSuggestions.set(false);
    this.selectedSuggestionIndex.set(-1);
  }

  hideSuggestionsDelayed(): void {
    // Short delay so mousedown on suggestion fires before blur hides it
    clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => this.showSuggestions.set(false), 150);
  }

  // ── AI Mode Controls ──────────────────────────────────────────────

  toggleAIMode(): void {
    if (this.chatService.aiModeEnabled()) {
      this.chatService.disableAIMode();
    } else {
      this.chatService.enableAIMode();
    }
  }

  toggleDemoMode(): void {
    this.chatService.toggleDemoMode();
  }

  selectProvider(provider: 'groq' | 'claude' | 'demo'): void {
    this.chatService.setAIProvider(provider);
    this.showProviderMenu.set(false);
  }

  getProviderButtonClass(): string {
    const provider = this.chatService.aiProvider();
    switch (provider) {
      case 'groq':
        return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100';
      case 'claude':
        return 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100';
      case 'demo':
        return 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100';
    }
  }

  saveApiKey(): void {
    const key = this.apiKeyInput().trim();
    if (key) {
      const provider = this.chatService.aiProvider();
      if (provider === 'groq') {
        this.chatService.setGroqApiKey(key);
      } else {
        this.chatService.setClaudeApiKey(key);
      }
      this.showApiKeyInput.set(false);
      this.apiKeyInput.set('');
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.shouldScrollToBottom = true;
      this.chatService.handleFileUpload(input.files[0]);
      input.value = '';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    if (event.dataTransfer?.files.length) {
      this.shouldScrollToBottom = true;
      this.chatService.handleFileUpload(event.dataTransfer.files[0]);
    }
  }

  renderMarkdown(text: string): string {
    if (!text) return '';

    let html = text;

    // Escape HTML
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');

    // Blockquotes
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

    // Tables
    html = this.renderTables(html);

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Clean up double line breaks
    html = html.replace(/\n\n/g, '<br/><br/>');
    html = html.replace(/\n/g, '<br/>');

    // Clean successive blockquotes
    html = html.replace(/<\/blockquote><br\/?><blockquote>/g, '<br/>');

    return html;
  }

  private renderTables(html: string): string {
    const lines = html.split('\n');
    const result: string[] = [];
    let inTable = false;
    let headerDone = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        const cells = line.split('|').filter(c => c.trim() !== '');

        // Check if separator row
        if (cells.every(c => /^[\s-:]+$/.test(c))) {
          headerDone = true;
          continue;
        }

        if (!inTable) {
          result.push('<table>');
          inTable = true;
          // This is the header row
          result.push('<thead><tr>');
          cells.forEach(c => result.push(`<th>${c.trim()}</th>`));
          result.push('</tr></thead><tbody>');
          continue;
        }

        result.push('<tr>');
        cells.forEach(c => result.push(`<td>${c.trim()}</td>`));
        result.push('</tr>');
      } else {
        if (inTable) {
          result.push('</tbody></table>');
          inTable = false;
          headerDone = false;
        }
        result.push(lines[i]);
      }
    }

    if (inTable) {
      result.push('</tbody></table>');
    }

    return result.join('');
  }

  // ── Session Management ────────────────────────────────────────────

  createNewSession(): void {
    this.chatService.createSession();
    this.shouldScrollToBottom = true;
  }

  deleteSession(id: string, event: Event): void {
    event.stopPropagation();
    this.chatService.deleteSession(id);
  }

  startEditSessionName(id: string, event: Event): void {
    event.stopPropagation();
    this.editingSessionId.set(id);
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('#sessionNameInput');
      input?.focus();
      input?.select();
    }, 10);
  }

  finishEditSessionName(id: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const newName = input.value.trim();
    if (newName) {
      this.chatService.renameSession(id, newName);
    }
    this.editingSessionId.set(null);
  }

  cancelEditSessionName(): void {
    this.editingSessionId.set(null);
  }

  private scrollToBottom(): void {
    const el = this.scrollContainer()?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
