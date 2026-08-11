class SystemPromptBuilder {
  private readonly sections: string[] = [];

  add(section: string): this {
    if (section.trim()) {
      this.sections.push(section);
    }

    return this;
  }

  build(): string {
    return this.sections.join("\n\n");
  }
}

export { SystemPromptBuilder };
