import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ImagePlus, X, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface CourtPhotosUploadProps {
  currentPhotoUrls: string[];
  onPhotosChanged: (urls: string[]) => void;
  maxPhotos?: number;
}

export function CourtPhotosUpload({
  currentPhotoUrls,
  onPhotosChanged,
  maxPhotos = 4,
}: CourtPhotosUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>(currentPhotoUrls || []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxPhotos - photoUrls.length;
    if (remainingSlots <= 0) {
      toast.error(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    
    // Validate all files
    for (const file of filesToUpload) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select only image files");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Each image must be less than 5MB");
        return;
      }
    }

    setUploading(true);
    const newUrls: string[] = [];

    try {
      for (const file of filesToUpload) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `courts/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("court-photos")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("court-photos")
          .getPublicUrl(filePath);

        newUrls.push(publicUrl);
      }

      const updatedUrls = [...photoUrls, ...newUrls];
      setPhotoUrls(updatedUrls);
      onPhotosChanged(updatedUrls);
      toast.success(`${newUrls.length} photo${newUrls.length > 1 ? 's' : ''} uploaded`);
    } catch (error: any) {
      console.error("Error uploading photos:", error);
      toast.error(error.message || "Failed to upload photos");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = (index: number) => {
    const updatedUrls = photoUrls.filter((_, i) => i !== index);
    setPhotoUrls(updatedUrls);
    onPhotosChanged(updatedUrls);
  };

  const movePhoto = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= photoUrls.length) return;
    const updatedUrls = [...photoUrls];
    const [movedItem] = updatedUrls.splice(fromIndex, 1);
    updatedUrls.splice(toIndex, 0, movedItem);
    setPhotoUrls(updatedUrls);
    onPhotosChanged(updatedUrls);
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="grid grid-cols-4 gap-1.5">
        {photoUrls.map((url, index) => (
          <div 
            key={url} 
            className={`relative group rounded-md overflow-hidden border border-border bg-muted ${
              index === 0 ? 'col-span-2 row-span-2' : ''
            } aspect-square`}
          >
            <img
              src={url}
              alt={`Court photo ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              {index > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => movePhoto(index, 0)}
                  title="Set as main photo"
                >
                  <span className="text-[8px] font-bold">1st</span>
                </Button>
              )}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-5 w-5"
                onClick={() => handleRemove(index)}
              >
                <X className="h-2.5 w-2.5" />
              </Button>
            </div>
            {index === 0 && (
              <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[8px] px-1 py-0.5 rounded-full font-medium">
                Main
              </div>
            )}
          </div>
        ))}

        {photoUrls.length < maxPhotos && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={`rounded-md border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 bg-muted/30 hover:bg-muted/50 transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 aspect-square`}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
            ) : (
              <>
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <ImagePlus className="h-3 w-3 text-primary" />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {photoUrls.length}/{maxPhotos}
                </p>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
