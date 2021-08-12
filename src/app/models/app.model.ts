export class SearchOption {
  public useLevenshtein = false;
  public useCustomSearch = false;
  public useUpperWord = false;
  public useFuse = false;
  public isSortScore = false;
  public scoreRange = [0, 3];
  public scoreSelected = [0.5, 1];
}
